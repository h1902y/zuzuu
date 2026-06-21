# Research: Session management — lifecycle, crash reconciliation, episode segmentation

> Persisted prior-art research synthesis (workflow `wf_0191bca2-149`). Background reasoning for the zuzuu redesign specs — not canon. Source-of-truth decisions live in `docs/specs/`.

---

I have all 8 research angles. No further tool calls needed — synthesizing directly.

# Session-as-Core: The Clock the Enhance Loop Runs On

A design brief for zuzuu's session contract. **enhance fires at session end, per collection** — so the session boundary IS the loop's clock. The research converges hard: every shipping agent uses **append-only log + lightweight index + replay-as-resume**, and zuzuu's existing `sessions.json` + OTLP traces + `doctor` is already structurally best-in-class. Three gaps to close: reconciliation, durability, segmentation.

---

## 1. The session lifecycle to adopt

**Keep zuzuu's existing state machine, add two named states and a per-turn write discipline.**

```
opening → active → completed        (graceful: SessionEnd fired, enhance ran)
                 → abandoned         (no clean close, owner dead → reconcile)
                 → crashed           (enhance itself interrupted → retry)
        [+ resurrectable]            (NEW: between abandoned/crashed and gone — queryable, enhance pending)
captured                            (post-hoc capture, never live)
```

The two state additions are borrowed: **Zellij's 6-state machine** (Created→Active→ActiveDetached→Killed→**Resurrectable**→Deleted, https://zellij.dev/documentation/session-resurrection.html) names the missing state between "dead" and "garbage-collected" — the state where enhance is still owed. **OTel session.previous_id** (https://opentelemetry.io/docs/specs/semconv/general/session/) gives the continuation grammar: stamp every session record with `session_id` + `previous_session_id` so crash-gaps and segment-rotations are queryable without requiring a clean prior close.

**What persists to disk, and when — the single highest-leverage change:**

| Transition | Write (atomic: tmp-then-rename) | Borrowed from |
|---|---|---|
| `opening→active` | lock file `{pid, startedAt, sessionId, epoch}` | PID-file pattern, proper-lockfile |
| **every turn** | append turn record to durable log; update `lastTurnAt`; refresh heartbeat mtime | Google ADK "write state before returning from tool call" (https://adk.dev/sessions/session/); LangGraph per-node checkpoint |
| `active→completed` | unlink lock (tombstone); run enhance | systemd ConditionPathExists tombstone |

The load-bearing borrow is **ADK's "write state atomically at turn-end, not session-end."** This converts enhance from "fires at session end or never" to "can fire from any committed turn boundary" — the structural fix for the lost-episode problem. Every shipping agent that does append-per-turn (Claude Code JSONL, OpenHands event-sourcing https://deepwiki.com/All-Hands-AI/OpenHands/12.2-event-storage-and-replay, Codex CLI) survives crash with the transcript intact to the last flush; every one that writes one mutable JSON blob (Cline, Roo Code https://docs.cline.bot/troubleshooting/task-history-recovery) has active **silent-data-loss bugs**.

**Cleanest borrowed model = durable-execution journal, not tmux-detach.** tmux/abduco/Screen keep session state in the *server process heap* (https://github.com/tmux/tmux) — unrecoverable on crash; that's the antipattern. The right mental model is **Temporal's event history** (https://docs.temporal.io/encyclopedia/event-history): append intent before a step, mark COMPLETE after, replay the log to reconstruct state. **zuzuu already has this — the per-session git branch `zz/session-<id>` with turn-checkpoint commits IS the event log.** Reconciliation = `git log zz/session-<id>` to find the last committed turn (the Mosh "last-acknowledged-state" recovery point, https://mosh.org/). No new infrastructure; just wire enhance into that replay path.

---

## 2. Crash reconciliation

**The most robust zero-dep classifier is a two-signal AND, checked lazily by `doctor` on every session-open — no daemon, no heartbeat loop.**

```
abandoned  ⟺  (state ≠ "completed")  AND  (kill(pid, 0) → ESRCH)
```

This is the convergent signal across Unix daemon literature, git tooling, and 2026 agent postmortems (crash-reconciliation angle). Each signal alone is ambiguous: a record stuck in "active" could be a genuinely long-running session; a dead PID alone tells you nothing about clean exit. **Together** they're high-confidence with no false positives.

**Mechanism (all `node:*`, zero deps):**
1. **On `opening`:** write `.zuzuu/sessions/<id>.lock` = `{pid: process.pid, startedAt, sessionId, epoch}` atomically (`O_CREAT|O_EXCL`). This is the canonical PostgreSQL/nginx/tmux `postmaster.pid` pattern (https://github.com/mattpocock/sandcastle/issues/427).
2. **On graceful close:** unlink the lock (**tombstone-on-exit**: absence = clean; presence + dead PID = crash — the systemd `ConditionPathExists` inversion, https://blogs.reliablepenguin.com/2025/12/01/using-conditionpathexists-and-friends-in-systemd-units).
3. **On any `doctor` / next session-open:** read each lock, `process.kill(pid, 0)`. `ESRCH` = dead → abandoned. `EPERM` = alive, another owner → honor. This is **on-demand, no continuous write burden** — strictly cheaper than a heartbeat for single-machine local-first.
4. **Reconcile:** for abandoned sessions, replay `git log zz/session-<id>` to the last turn-checkpoint, run enhance retroactively from the durable transcript (zuzuu's `doctor` already reconciles from transcript — wire enhance in explicitly).

**Harden enhance itself against mid-run crash (the WAL insight, https://sqlite.org/wal.html — "no commit record = not applied"):** before firing enhance, write `enhanceState: {startedAt, pid}` to the session record; clear it atomically on completion. `doctor` seeing `enhanceState` present + dead PID = enhance was interrupted → re-queue (the `crashed` state). This makes the loop fully self-healing without human intervention.

**Why not heartbeat/lease (Temporal activity-heartbeat, proper-lockfile mtime-refresh, https://github.com/moxystudio/node-proper-lockfile):** it adds a continuous-write daemon dependency. Reserve it **only** for the `web/` daemon if it runs continuously and you want *proactive* (not next-open) detection — write `lastTurnAt` + heartbeat mtime, flag sessions stale after `3×interval`. For the CLI MVP: PID-file + tombstone + lazy `doctor` is sufficient and lighter.

**Epoch for takeover (Restate, https://restate.dev/blog/the-anatomy-of-a-durable-execution-stack-from-first-principles/):** when a session is resumed/reopened, write a monotonically-increasing `epoch` to the record; any lingering process detecting a higher epoch yields. Maps directly onto zuzuu's single-working-branch invariant and the worktree-lock case (Claude Code #55724 — agent killed mid-session loses worktree state).

**Most robust zero-dep option, named: PID-file + `kill(pid,0)` + tombstone-on-exit, reconciled lazily by `doctor`, with a WAL-style `enhanceState` sentinel guarding the enhance step.**

---

## 3. Segmentation into episodes

**Default: two zero-dep triggers in OR, plus a per-N-turns warm-layer write. ML earns its place only offline, in the reconcile path.**

```
episode_close  ⟺  (turn_count / transcript_bytes ≥ 64% of ceiling)   ← token-budget proxy
               OR  (idle_gap ≥ 60 min)                                ← GA4 inactivity rule
```

**Primary trigger — token-budget two-stage (64% warn / 80% rotate), the dominant 2025–26 production pattern** (https://zylos.ai/research/2026-03-31-context-window-management-session-lifecycle-long-running-agents/, used by SWE-agent/OpenHands/Cursor). At **64%** of a configurable ceiling: write a handoff digest early (while the agent is still coherent — never wait for 100%, context rot starts well before the limit). At **80%**: seal the episode, squash-merge the session branch, open a new worktree seeded with the handoff. The 16-point gap is a cooldown preventing thrash. zuzuu has no token counter for the host, so use **cumulative turn count or captured-transcript byte size as the proxy** — O(1) per turn, already in the trace.

**Secondary trigger — idle-gap, the GA4/PostHog 30-min inactivity rule** (https://support.google.com/analytics/answer/9191807), tuned to **60 min for coding** (a dev may think 40 min without a turn; 30 min over-fragments). This is the one that **catches crashes for free**: when `doctor` re-reads an abandoned transcript, the stale last-event timestamp retroactively triggers idle-gap segmentation. Combine with token-budget via OR — whichever fires first.

**The reconciliation-critical piece — anchored warm-layer write every ~20 turns** (tiered hot/warm/cold, https://agentmarketcap.ai/blog/2026/04/11/agent-context-engineering-sliding-windows-memory-2026): write a running `episode-summary.md` to `.zuzuu/.live/` every 20 turns, **merging new info into the existing anchor, never rewriting from scratch.** This is what makes crash recovery viable for long sessions: `doctor` reads the last warm-layer write as the partial-episode record and runs enhance retroactively without needing a clean close. The structured handoff anchor = `{intent, changes_made, decisions_taken, next_steps, warnings}` — which **maps directly onto zuzuu's existing digest** (knowledge + instructions + memory + proposals); add `priority-queue` (next steps) and `decision-log` as two new digest sections. **Avoid summarization drift** (Letta's failure mode, https://github.com/letta-ai/letta — rewriting from scratch silently drops low-frequency-but-critical details after 3–4 passes).

**Segment data model — the (session_id, segment_index) tuple** (rrweb/PostHog recording segmentation, https://posthog.com/docs/how-posthog-works/recordings-ingestion): each episode = one monotonic segment inside the session; enhance consumes one segment's turns; advance the pointer for the next cycle. Pair with **Zep/Graphiti bi-temporal stamping** (https://github.com/getzep/graphiti): `valid_time` = when the session happened, `ingested_at` = when enhance ran — so a session crashed Monday and reconciled Thursday is correctly dated to Monday. Critical for episodic-memory integrity.

**When ML earns its place — offline only, never the hot path.** The research consensus (TiMem https://arxiv.org/abs/2601.02845, ES-Mem https://arxiv.org/abs/2601.07582) is that *semantic*-boundary detection beats fixed cuts for retrieval quality — but it costs an LLM call per turn. Run it **only in the `doctor`/reconcile path** over a finished transcript, never inline. For chunking a huge crashed transcript before enhance: **fixed-token chunking with overlap (8K window, ~1K overlap)** (E-mem, https://arxiv.org/html/2601.21714v1) is the portable zero-dep pattern. **Avoid the classical text segmenters** (TextTiling https://github.com/stylianipantela/texttiling, C99 https://github.com/logological/C99): they're tuned for document monologue, degrade on short-turn coding dialogue (vocabulary turnover too slow), and C99 is O(n²). PELT/ruptures (https://github.com/deepcharles/ruptures) needs numpy (~15MB) — inadmissible. TextTiling's depth-score **valley detection (mean−stdev cutoff)** is worth borrowing only as a *normalizer* on a scalar score, if a semantic signal is ever needed inside an already-bounded episode.

---

## 4. What "Hermes" turned out to be

**NousResearch Hermes Agent** (released Feb 2026, MIT, Python, SQLite-WAL, https://github.com/NousResearch/hermes-agent) — a self-improving agent with a session lifecycle. **Worth borrowing three things:** (1) **`end_session(reason)` with first-write-wins** on termination reason (prevents races from multiple shutdown signals); (2) the **pre-boundary "save memories" agent turn** before any idle/daily/compress cut — this is literally the enhance-before-boundary pattern, run it before recording the cut; (3) **composite session key** (host+directory+session-id) to prevent cross-contamination when one user runs multiple agents. *Not* the Elixir `hermes_mcp` library (SSE event-ID resumption, wrong stack). Hermes has **no crash reconciliation** of its own — zuzuu's `doctor` already exceeds it there.

---

## 5. Adopt verbatim / adapt / avoid — mapped to existing assets

**KEEP (already best-in-class, don't touch):**
- **`sessions.json` index + OTLP/JSONL traces split** — exactly the universal "lightweight index + append-only body" pattern (Claude Code does this well; Cline conflates them and loses both). Already correct.
- **`doctor` as the out-of-band reconciliation sweep** — this is precisely the watchdog that LangGraph/CrewAI/Claude Code all *lack* (Diagrid postmortem, https://www.diagrid.io/blog/checkpoints-are-not-durable-execution-why-langgraph-crewai-google-adk-and-others-fall-short-for-production-agent-workflows). zuzuu's architecture is ahead here. Just run it on **every** session-open, not only explicit invocation.
- **Per-session git branch + turn-checkpoint commits** — already a Temporal-grade event log. The recovery point is `git log zz/session-<id>`.
- **Worktree-per-session isolation** (Wave B) — the zmx isolated-daemon-per-session model (https://lobste.rs/s/fvdh2d/zmx_session_persistence_for_terminal); one crash can't contaminate others. Keep it.
- **Plain-JSON / human-readable manifests** — the Zellij `.kdl` / aider `.aider.chat.history.md` "human-readable so it survives" instinct.

**ADAPT (change these):**
- **Add per-turn durable write** (ADK pattern). Today enhance keys off session-end; make every turn-checkpoint also flush `lastTurnAt` + the turn record so enhance can fire from any boundary. **The single most important change.**
- **Make the `sessions.json` write atomic** (tmp-then-rename) — today an in-place mutation is one crash from the Cline corruption bug. If the index ever exceeds a few hundred entries, move the *mutable turn log* (not the git-tracked index) to **`node:sqlite` with `PRAGMA journal_mode=WAL`** — auto-recovery on open, zero new deps, already in zuzuu's toolbox (Goose's v1.10 JSONL→SQLite migration, https://block.github.io/goose/docs/guides/managing-goose-sessions/, was a direct fix for tail-corruption).
- **Add the PID-lock + tombstone + epoch** to `session-worktree.mjs` / `session-git.mjs`: write `{pid, sessionId, createdAt, epoch}` on worktree creation, `kill(pid,0)`-check in `doctor`, fire retroactive enhance on dead-owner worktrees (closes the Claude Code #55724 / Sandcastle #427 gap).
- **Add `enhanceState` sentinel** (WAL pattern) so a crash *during* enhance is detectable and retriggerable.
- **Add segmentation triggers + warm-layer write** — new: 64/80 token-proxy + 60-min idle OR, with `episode-summary.md` every 20 turns and `(session_id, segment_index)` + bi-temporal stamps on records.
- **Extend the digest** with `priority-queue` + `decision-log` sections, and write it at episode **END** as well as start (it's the recovery artifact, not just an orientation brief).
- **Stamp `previous_session_id`** on every record (OTel grammar) so segment-rotations and crash-gaps are queryable.
- **Gate retroactive enhance on a reconciled session behind explicit human confirmation** (Zellij "Press ENTER to run" banner) — a partial/incomplete transcript can produce garbage proposals; zuzuu's review gate is already human-in-the-loop, so route reconciled-enhance proposals through it with a "reconciled, may be incomplete" flag.

**AVOID:**
- **One mutable JSON blob per session** (Cline/Roo — silent data loss on parse error).
- **State only in a server-process heap** (tmux/Screen — unrecoverable on crash).
- **Coupling session state to a host/IDE address space** (Cursor https://cursor.com/, Continue.dev VS Code extension exit-133 — out-of-process crash = total loss). zuzuu's out-of-process CLI/daemon model is structurally safer; keep it that way.
- **Relying on a graceful-exit hook (SessionEnd/atexit) as the only enhance trigger** — SIGKILL guarantees it never fires (no shipping agent fires its end hook on kill). The reconciliation path is mandatory, not optional.
- **Failing the whole session on one corrupt record** (Goose/Cline parsers) — read records independently, treat a bad tail as "interrupted at turn N."
- **Importing Temporal/Restate/Letta/Mem0/Graphiti/Cognee runtimes** — server/numpy/vector-DB deps violate the zero-dep local-first core. Borrow the *patterns* (WAL, epoch, PENDING→COMPLETE, bi-temporal), which are all portable to `node:*`.
- **Classical text segmenters as primary triggers** (TextTiling/C99/TopicTiling/PELT) — wrong shape for short-turn dialogue and/or dep-heavy.
- **Explicit-save-only recovery** (aider community extension) — guarantees loss in exactly the crash scenario recovery exists for.

---

## 6. Open risks / unknowns the research could not close

1. **Episode-boundary *quality* is genuinely unvalidated for coding transcripts.** Every cited segmentation method (TextTiling, C99, ES-Mem topic-smoothing, BIC) was benchmarked on document monologue or human chat — **none on short-turn agent/tool-call transcripts**, where vocabulary turnover is slow and each turn is a different tool call. The token-budget + idle-gap OR is the *safe* default precisely because it sidesteps semantic quality, but **whether a 20-turn / 64%-budget cut produces a coherent enhance episode is an empirical question only zuzuu's own data can answer.** Recommend: ship the zero-dep triggers, log episode boundaries + the resulting enhance proposal quality, and tune the thresholds against real `~/Documents/zuzuu-experiments/` sessions before committing to defaults.

2. **The multi-day digest problem is not solved by any cited system — only deferred.** No shipping agent has explicit episode segmentation (Claude Code's `/compact` is the closest, and it's context-window-reactive, not episode-structured). The hierarchical-consolidation research (TiMem's L1–L5 tiers) is the right *direction* but is arXiv-only, LLM-call-heavy, and unreleased. **The open risk: a genuinely multi-day session produces N episodes, and how to consolidate N per-episode enhance outputs into one coherent whole-brain update — without summarization drift across episodes — has no proven zero-dep recipe.** The anchor-and-merge warm-layer mitigates *within* a session; *across* episodes/days it's untested. This likely needs the (still design-only) async Cloudflare Workflows evolution service to do hierarchical rollup offline.

3. **Token-budget proxy fidelity.** zuzuu can't see the host's real token count, so turn-count/byte-size is a proxy. A session with a few enormous tool outputs vs. many tiny turns will hit the real context ceiling at very different proxy values — the proxy may fire too early or too late. Unknown until measured per-host.

4. **`enhanceState` retry idempotency.** Re-running enhance on a reconciled session must not produce duplicate knowledge entries. The research prescribes a **deterministic idempotency key per session** (Temporal/DBOS) — zuzuu already derives deterministic sha256 ids, so this is tractable, but the dedup behavior of the *enhance miners* on re-run is not verified and must be tested.

5. **Heartbeat vs. lazy-`doctor` for the `web/` daemon.** For the pure CLI, lazy detection is provably sufficient. For a long-running workbench daemon supervising concurrent worktrees, *proactive* detection (a heartbeat loop) may be wanted — but the research can't say whether the added write burden is justified for local single-machine use. Decide empirically once the daemon's concurrency profile is known.

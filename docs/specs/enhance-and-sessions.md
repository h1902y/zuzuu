# Sessions, Conversation & Enhance — the living loop

- **Status:** design spec (validated). Consolidates the session/conversation/enhance design thread.
- **Date:** 2026-06-20
- **Scope:** how a conversation becomes durable module growth — the session contract, the git mapping, the intent model, steering, and the enhance loop. Sits above `cli-revamp.md` (architecture) and `from-scratch-blueprint.md` (build order); operationalizes the loop those describe.
- **Validation:** direction confirmed convergently across compound-engineering, spec-driven dev (Kiro/Spec-Kit/BMAD), plan-execute agents (Plan-and-Act/ADaPT), compounding loops (Reflexion/ExpeL/Voyager/ERL), and HITL research — see `docs/inspiration/research/05-conversation-planning-validation.md`. The **live forward intent stack** is genuine differentiation (no equivalent in prior art); the **human gate** is the moat (the only defense against the knowledge-poisoning every automated competitor hits).
- **Discipline (read first):** ship the **episode-only path first**. Lanes, sub-sessions, typed feedback, stop-rules are *opt-in additions*, not the default. Gate every mechanism on one test: **does an episode close better because of it?** The Spec-Kit postmortem (2,577 lines/feature, bug still slipped) is the warning against front-loaded ceremony.

---

## 1. The model in one breath

> A **session** is a **conversation** is a git **branch** (1:1). A **turn** is the atom. Within a session, **episodes** are pursuits of one objective each — and the objectives live in a **steerable stack** the conversation drives. Two tracks run in parallel: the **conversation track** (all turns → Knowledge/Memory) and the **work track** (file-changing turns = commits → Actions). At close, **enhance** reads both, proposes typed changes, and a human gate promotes them into the right **module**.

Everything below is detail on those sentences.

## 2. The two tracks

A session is not one stream — it is two, with different shapes:

- **Conversation track** — every turn, talk or work. The transcript. Always exists (a conversation always happened). Feeds **Knowledge** (facts) and **Memory** (episodes).
- **Work track** — only turns that changed files: git checkpoint commits, grouped into episodes. Exists when work happens. Feeds **Actions** (procedures).

A pulse-check ("how does auth work?") has a full conversation track and an **empty** work track → zero episodes, an **unborn branch**, zero git footprint. The branch is born lazily on the **first work turn** (git's own unborn-branch model). Episodes belong to the *intent timeline*, not the work track — see §4.

## 3. Session ≡ conversation ≡ branch (the git mapping)

The git substrate carries the whole session; `git log` is its journal. The lifecycle is a choreography of git verbs, renamed for humans (the porcelain rule — user vocabulary is just **session** + the verb **recover**).

| Session event | Git | User sees |
|---|---|---|
| open | (branch unborn) | session goes live |
| protect pre-existing WIP | a **baseline** commit | "your work is saved first" |
| each work turn | one checkpoint commit (`Zz-Intent`, `Zz-Tests` trailers) | saved automatically |
| episode closes | checkpoints autosquash → one clean Conventional-Commit | — |
| session closes | squash-merge to working branch → **enhance** | "what I learned" |
| crash | branch + commits intact to last turn | recover |
| undo a session | `reset --hard ORIG_HEAD` | undo |

**Metadata is git trailers, never git notes** (squash-merge orphans notes — and our close *is* a squash): `Zz-Session`, `Zz-Intent`, `Zz-Episode`, `Zz-Tests`, `Zz-Remember`. The git log is the episode index (`git log --format=…(trailers)`). The episode commit body carries **what / why / tried / next** — `tried` (rejected alternatives) is the highest-signal enhance input.

**Reconciliation** is git-native: `doctor` finds any non-closed branch whose owner PID is dead (`kill(pid,0)→ESRCH`), reads `git log` to the last checkpoint, and runs enhance retroactively, flagged "recovered — may be incomplete." A WAL-style `enhanceState` sentinel makes a crash *during* enhance itself recoverable. We borrow jj's **patterns** (change-id→trailer, op-log→git log) but never the binary; jj is a runtime-detected opt-in accelerator only.

> Deeper treatment of the git substrate: `docs/inspiration/git-from-scratch.md`. Crash/segmentation prior art: `docs/inspiration/research/01` and `03`.

## 4. The intent timeline — episodes & the objective stack

This is the correction that makes the model robust. **An episode is the pursuit of one objective, not a span of file-changes.** Every episode has an **outcome**:

| Outcome | Meaning | Git footprint |
|---|---|---|
| **done** | objective achieved | a squash commit (if work happened) |
| **reverted** | discovered wrong, undone | commits, then `git reset` (reflog keeps them) |
| **superseded** | user steered elsewhere | commits sealed where they are |
| **abandoned** | dropped, unresolved | partial range, or nothing |

A no-file-change **discovery** episode ("should we use library X? — no, unmaintained") is first-class and high-value. A **reverted** episode is the *richest* signal — confirmed empirically: failure-derived heuristics beat success-derived by **+14.3%** (ERL). So enhance must treat reverted/discovery episodes as **higher-priority proposals**, not equal to successes.

### The three-layer intent split

A single `intent.md` conflated three timescales that proven systems (Kiro, BMAD, compound-engineering) keep separate. zuzuu splits them, reusing surfaces it already has:

| Layer | Lives in | Timescale | Authored by |
|---|---|---|---|
| **steering** | `.zuzuu/instructions/` (the instructions module) | stable | human (gated) |
| **objective stack** | `.zuzuu/.live/intent.md` | per-session | the conversation |
| **episode tasks** | a sub-list within the stack | per-episode | the agent |

The objective stack (`.live/intent.md`) is the steerable heart — a human-readable list of objectives, each with its **done-test** and a **stop rule** (an explicit escalate-vs-continue condition, not just an outcome type). Alongside it sits a **machine-readable `intent.json`** (typed episode records: `status: pending|active|done|reverted|superseded|abandoned`) — **hook-generated, never hand-authored**: the human reads the prose, the agent writes the status. The stack is **re-anchored every turn** via a cheap "still valid?" check (a stale stack is a documented drift vector), not a full LLM replan.

## 5. The canonical conversation flow

Each step borrows a proven pattern; the front-load stays light.

1. **Greet + recap + nudge** — read steering + the last session's outcome (its squash-commit body / memory zu) + proposed next steps; the digest gains a synthesized "Current Tracks" section. *(Interactive greeting is drive-mode; observe-mode injects the digest as the session-start message.)*
2. **Scope checkpoint (blocking)** — present the inferred objective + decision-forks, **block** on confirmation. The reply *is* the objective-stack write. *(ce-plan Phase 0.7.)*
3. **Write the objective stack** — each objective carries its done-test + stop rule; repo-relative refs (worktree-portable).
4. **Episode execution** — attempt the objective directly; decompose into sub-episodes **only on failure** (lazy beats eager 27–33%, ADaPT). Gate: no execution without a written objective in the stack ("plan-before-code", LFG).
5. **Episode close** — an **explicit structured outcome signal** in the transcript (`<episode outcome="reverted"/>`), not git-inferred.
6. **Enhance at session close** — auto-fires from the SessionEnd hook (never a manual command); parallel miners; typed proposals → a **batched** human gate.

## 6. Steering — the differentiated, hardest part

A steer is a **first-class path**, not a normal turn. Treating an interrupt as a surface message instead of a state-changing event is the #1 steerability bug (InterruptBench). Handle by **type**:

- **Addition** ("also do X") → push onto the stack; the prior objective persists.
- **Revision** ("change X to Y") → may reuse prior work.
- **Retraction** ("that failed, undo") → the expensive case: `git reset` + close the active episode as **reverted** + open a new one + **reconcile the environment to match the post-steer intent** (the documented bottleneck — make it explicit). The outer loop writes a "tried X, avoid because Y" zu — the gold.
- **Cumulative belief:** an objective persists until *explicitly* transitioned; a newly stated objective never silently replaces the prior one.

## 7. Enhance — the compounding loop

What enhance reads and proposes, with each borrowing named:

- **Inputs:** the conversation track (intent) + the work track (episodes + git diffs + run events). Joining intent with behavior is the leverage — it mines *what worked*, not just *what was said*.
- **Routing:** fact → Knowledge; episodic record/decision → Memory; reusable procedure → Actions (**store-after-verification** — approved only after a successful dry-run, Voyager); steering correction → Instructions.
- **Proposal shape:** the **Bug Track / Knowledge Track** split (ce-compound); a **structured heuristic format** (*trigger condition + action*, ERL) so items are directly actionable; **evidence-backed** (the exact log/session refs).
- **Dedup:** **overlap-scoring** before writing (4+ shared dimensions → propose an *update*, not a new item) — prevents the junk-drawer.
- **Discoverability:** when a learning lands, auto-check the digest references its category (or the agent won't find it next time).
- **Corroboration:** surface a proposal when **N sessions** corroborate a pattern, not on first sight (Generative Agents; already the guardrails-miner discipline).
- **Self-improvement:** approving "Useful" / rejecting "Misleading" adjusts a **per-miner trust weight** in `eval` (MemTier) — this is the *only* reason to keep the Useful/Misleading label; without that wiring, cut it.
- **When:** per-session at close (per-turn is too noisy for durable compounding).

## 8. The three human gates

| Gate | When | Verbs |
|---|---|---|
| **Start** — objective approval | pre-execution, blocking, brief | approve / edit / redirect |
| **Mid** — steering | synchronous interrupt | approve / edit / reject / redirect (= stack ops) |
| **Close** — enhance proposals | async, **batch** | approve / edit / reject / redirect, per proposal |

**Fatigue rules (load-bearing):** batch the close gate (never one-proposal-per-interrupt — the rubber-stamp trap); the approved objective stack is an **envelope** (in-envelope tool calls don't re-prompt; only deviations gate); **reversibility-driven friction** (Knowledge = soft/low; a Guardrails rule = irreversible/high — explicit confirm + label); hold escalation to **10–15%**; track **override-rate** (rejected fraction) as the miner-quality metric — **>30% = noisy miners, recalibrate `eval`, don't add gates.**

Two advantages to state plainly: zuzuu's guardrails gate is a **real PreToolUse tool restriction** (Claude plan-mode's "readonly" is only prompt-enforced); and the human gate is the **only** defense against knowledge poisoning that every automated competitor structurally lacks — the moat.

## 9. The worked extremes (the canonical examples)

The model's edges, each showing git + tracks + modules.

- **Pulse check (0 episodes).** "How does auth work?" → no file change → **unborn branch**, zero git footprint. enhance reads the conversation track → maybe one Knowledge fact, often **nothing** (a valid outcome). Actions untouched (nothing ran).
- **3-day marathon + crash (N episodes).** baseline → green-build episodes + an idle-gap fallback episode → laptop dies mid-turn → `doctor` reconciles from `git log`, commits the uncommitted turn, runs enhance flagged "recovered" → close folds all checkpoints into clean episode commits → final enhance over the whole conversation, back-dated (bi-temporal) → one **batched** gate.
- **Fork (lane vs sub-session).** "Try streaming *and* load-all." → two lanes → streaming wins → merge its squash + summary back (context firewall), abandon the other; the winning commit carries `Zz-Rejected: load-all — 4× memory` → enhance mines the rejected path into Knowledge. *(Lane = shares infra, dies in-session; sub-session = needs isolated context, may outlive the turn.)*
- **Rewind.** "Undo everything since you touched auth." → find the turn via `Zz-Intent` → `git reset --hard` to before it (reflog keeps the rest); both tracks rewind together. The only irreversible rewind is *after* the squash — the deliberate "forget."
- **Correction (drift).** Agent discovers `deploy: Heroku` is now Fly. → enhance proposes an **update** to the existing zu (Misleading → the new fact), the zu's generation bumps (old pinned, rollback-able). The brain self-corrects through the gate — immutable-snapshot-plus-pointer, applied to the mind.

## 10. Observe vs drive — what degrades

The richest mechanisms (per-turn replan, enforced outcome signals, `Command(resume=)` mid-loop) assume we **drive** the conversation. Under **observe** (Claude Code/Codex), we don't control the host's message stream — we regenerate + inject the digest/stack via the SessionStart hook and *request* the outcome convention via instructions (directive, not enforced). So:

| Mechanism | Observe (now) | Drive (pi, later) |
|---|---|---|
| start digest | injected via hook ✓ | injected ✓ |
| objective stack | regenerated + injected; agent *asked* to honor | owned, enforced |
| episode-outcome signal | requested convention (best-effort) | enforced gate |
| steering / rewind | git-level (rewind = `git reset`); re-anchor-and-hope | full per-turn replan |
| guardrails gate | real PreToolUse restriction ✓ | ✓ |
| enhance at close | SessionEnd hook ✓ | ✓ |

**Full steering robustness is gated on the drive harness.** State this honestly everywhere; never ship a contract the observed host can't honor. The substrate we always control — **git, `.live/` files, the SessionStart hook, the guardrails gate** — carries the observe-mode version.

## 11. Open risks

1. **Observe-vs-drive** (§10) — structural; mitigated by leaning on the always-controlled substrate, honest about the degraded path.
2. **Complexity creep** — the intent split + `intent.json` + stop-rules + trust-weights pull toward more surface. Discipline: `intent.json` is hook-generated; the split reuses the existing instructions module; **gate every addition on "does an episode close better?"** Ship episode-only first.
3. **Intent-stack is novel** — its specific transition mechanics have no external validation. Build with confidence, but **instrument the episode-boundary rules and treat the first N real sessions as calibration data**, not finished design.

---

## References

- Research: `docs/inspiration/research/` (01 session-mgmt · 03 opinionated-git · 04 harness-experience · 05 conversation-planning-validation).
- Git substrate: `docs/inspiration/git-from-scratch.md`.
- Architecture + build order: `docs/specs/cli-revamp.md`, `docs/specs/from-scratch-blueprint.md`.
- Risk register (R1 safety, R7 frontmatter, R8 observe-vs-drive): `docs/specs/thesis-and-risks.md`.

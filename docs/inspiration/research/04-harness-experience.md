# Research: AI agent harness experience — session-conversation structure, steering, branching, module linkage

> Persisted prior-art research synthesis (workflow `wf_035cd6eb-fa2`). Background reasoning for the zuzuu redesign specs — not canon. Source-of-truth decisions live in `docs/specs/`.

---

I have all 7 research angles plus the prior design context. This is a synthesis task — no tool calls needed. Let me produce the capstone brief.

# zuzuu Session-Conversation Experience — Recommended Structure

The convergent finding across every harness studied is that zuzuu's core primitives are already right (turn=commit on a real branch, lazy branch birth, human-gated enhance, the digest), and that the *opinionation* problem is solved not by inventing mechanisms but by **wiring the five modules into a session lifecycle that mirrors git's own discipline**: a frozen brief at open, mechanical checkpoints during, a declared boundary at close, and a gated promotion from the work to the modules. What follows is one coherent structure, not a feature list.

---

## 1. The opinionated session-conversation experience

zuzuu should feel like **git for the agent's mind**: every session opens with a clean working state, accumulates honest history, and closes with a deliberate landing — never a silent compaction.

**Start ritual — the brief + the contract.** At session open, `digest.md` is injected as a *conversation message*, not a file reference. This is the single most important borrowed mechanism: Claude Code's SessionStart hook injects git state/env as actual messages, which carry far more weight than probabilistic file reads ([Piebald system-prompt corpus](https://github.com/Piebald-AI/claude-code-system-prompts)). zuzuu already does this. The digest must be **header-first / detail-on-demand** — module name + one-line status at the top, full content below — matching Goose's scan-frontmatter-then-load pattern ([maxamillion.sh](https://maxamillion.sh/blog/stop-building-agents-start-harnessing-goose/)) and HumanLayer's progressive disclosure ([humanlayer.dev](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)). Aider's repo-map idea sharpens this: the digest should carry a *ranked-relevance* subset of zus tied to the declared intent, not all zus ([aider.chat](https://aider.chat/docs/usage/modes.html)).

The brief carries a **session contract** declared at *open*, not inferred at close. Devin's hardest-won lesson is that sessions work when requirements are set upfront and degrade when intent drifts mid-task ([cognition.ai](https://cognition.ai/blog/devin-annual-performance-review-2025)); Harness Engineering names this the "sprint contract" — generator and evaluator agree on *done* before work starts ([addyosmani.com](https://addyosmani.com/blog/agent-harness-engineering/)). For zuzuu this makes the **episode boundary mechanical instead of ambiguous**: the human's intent becomes the `Zz-Intent` trailer at squash, and "episodes are declared not detected" stops being aspirational.

**In-session — what the agent does when.** A four-slot session state (Devin's Task / Plan / PR / Summary, [medium](https://medium.com/@nitinmatani22/how-devin-ai-actually-thinks-autonomous-planning-dag-execution-and-dynamic-re-planning-explained-997be175a475)) lives in `.zuzuu/.live/intent.md`. The agent self-narrates a cumulative `<summary>` per turn (the pi extension pattern: emit a summary block each response, warn when skipped, [pi-ext-session-summary](https://github.com/wesen/2026-04-21--pi-extensions/blob/main/ttmp/2026/04/23/pi-ext-session-summary--pi-extension-session-summary-block-with-system-prompt-injection/design/implementation.md)). Steering distinguishes **now vs at-boundary**: Amp's `Esc Esc` (interrupt this turn) vs `Enter Enter` (queue for next step) maps directly onto the turn model — "steer now" vs "steer at episode boundary" ([ampcode.com/manual](https://ampcode.com/manual)).

**The human gate — four options, not two, at boundaries not turns.** The field has converged past approve/reject. Warp surfaces **approve / edit / reject / redirect** — "redirect" (tell me what's wrong, retry) is the missing verb in most gates ([digitalapplied.com](https://www.digitalapplied.com/blog/warp-ai-terminal-agentic-cli-workflows-guide)). Devin's **Useful / Misleading** split is the cleanest module-growth UX: present "this knowledge helped" and "this knowledge was wrong" as *separate typed lanes*, not a flat inbox ([docs.devin.ai](https://docs.devin.ai/product-guides/session-insights)). And gate at **episode boundaries, not per-turn** — Thoughtworks' human-on-the-loop model (encode constraints upfront → review aggregated → periodic "Go See" spot-checks) is the antidote to approval fatigue ([thoughtworks.com](https://www.thoughtworks.com/en-us/insights/blog/generative-ai/cybernetics-and-human-on-the-loop-in-agentic-coding)). zuzuu's deny/ask/allow tiers already map; add **redirect** to the proposal gate and the **Useful/Misleading** typing to the enhance queue.

**Close ritual — handoff, not compaction.** This is the strongest single finding. Amp studied 1,281 runs and *retired compaction entirely* because recursive summaries degrade accuracy; they replaced it with `/handoff` — a fresh thread carrying curated files + synthesized goal, original left intact ([tessl.io](https://tessl.io/blog/amp-retires-compaction-for-a-cleaner-handoff-in-the-coding-agent-context-race/)). Roo Code's community backlash on auto-condensing (#5616) independently confirms it ([deepwiki](https://deepwiki.com/RooCodeInc/Roo-Code/7-context-and-message-management)). For zuzuu the **episode-squash commit IS the handoff artifact**: its message body is the curated summary, its `Zz-Intent` trailer becomes the next session's opening steering ("plan history survives resume" — Codex, [developers.openai.com](https://developers.openai.com/codex/cli/features)). The close ritual runs the **session-close enhance pass** while the transcript is hot — Letta's sleep-time timing, now human-gated ([letta.com](https://www.letta.com/blog/sleep-time-compute)).

---

## 2. Root-level steering — how the project guides the conversation

The field has converged on a **two-tier activation model**: one always-on root contract + topic files that activate conditionally. zuzuu should adopt this precedence stack:

| Layer | File | Activation | Source pattern |
|---|---|---|---|
| Always-on contract | `.zuzuu/.live/digest.md` (injected as message) | every turn | Claude Code SessionStart hook |
| Cross-tool shim | `AGENTS.md` (generated from digest) | every turn, any host | [AAIF standard, 60k+ repos](https://www.augmentcode.com/guides/how-to-build-agents-md) |
| Project steering | `.zuzuu/instructions/*.md` | scope-tagged | Kiro/Cursor 4-mode |
| Module steering | `.zuzuu/modules/<m>/instructions.md` | `fileMatch` glob on module dir | [Copilot applyTo](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide) |
| User global | `~/.zuzuu/instructions/` | every session, lowest precedence | [OpenCode 3-scope](https://opencode.ai/docs/rules/) |

**The four activation modes** (Kiro steering frontmatter, [kiro.dev](https://kiro.dev/docs/steering/); Cursor `.mdc`, [vibecodingacademy](https://www.vibecodingacademy.ai/blog/cursor-rules-complete-guide)) are the key import:
- `always` → session contract + project overview (the digest's spine).
- `fileMatch` (glob) → module steering loads only when that module's files are touched ("campaigns" conventions inject only when campaign files are in play — Amp's glob-scoped frontmatter, [ampcode.com/manual](https://ampcode.com/manual)).
- `agent-requested` (description-triggered) → **the harvest-at-close and branch-declaration protocols** auto-load when the agent detects "wrapping up / finishing / ending" intent — *no user invocation needed*. This is Cursor's Agent-Requested mode and it's exactly what the session-end ritual requires.
- `manual` (`#ref` / `@mention`) → deep knowledge zus, recalled on demand.

**Precedence:** workspace beats global, nearest-file-wins (AGENTS.md nesting, [augmentcode](https://www.augmentcode.com/guides/how-to-build-agents-md)). **Critical constraints**, hard-won: (1) the always-on layer stays **under ~150 lines / 12k chars** — every token burns every turn (Windsurf's budget, [windsurf.com](https://windsurf.com/university/general-education/creating-modifying-rules)); (2) the **ratchet principle** — every steering rule must trace to a real session failure, cited via `Zz-Session` trailer as provenance, never brainstormed ([addyosmani.com](https://addyosmani.com/blog/agent-harness-engineering/)); (3) **strict separation** of instructions (governance, non-negotiable, loaded as ground truth) from knowledge (learned, mined, gated) — Claude Code's field lesson that conflating the two causes drift ([medium](https://medium.com/@bijit211987/the-complete-guide-to-claude-md-memory-rules-loading-and-cross-tool-compression-97cc12ed037b)); Cursor's 2025 *deprecation* of free-form conversation-to-memory in favor of governed Rules is the cautionary tale ([blockchain-council](https://www.blockchain-council.org/ai/cursor-ai-track-memory-across-conversations/)).

**AGENTS.md is generated, not authored** — it's the portability shim that makes `.zuzuu/` legible to non-Claude hosts (the observe posture demands it). Generate it mechanically from the digest; never hand-edit.

---

## 3. Task branching & merging

The convergent industry pattern: **one git worktree per concurrent thread, a two-level branch hierarchy, squash-merge at the boundary** (Claude-Squad, [github](https://github.com/smtg-ai/claude-squad); OpenHands, [openhands.dev](https://www.openhands.dev/blog/automating-massive-refactors-with-parallel-agents); Conductor, [conductor.build](https://www.conductor.build/); Cursor, [cursor.com/docs/context/subagents](https://cursor.com/docs/context/subagents)). This maps onto zuzuu's existing model with **zero redesign** — Wave B already built the worktrees.

**The fork spectrum — episode vs sub-session vs lane.** The single sharpest decision is *when a sub-task earns its own session.* Codex's `/side` vs `/fork` ([codex.danielvaughan.com](https://codex.danielvaughan.com/2026/06/04/codex-cli-side-conversations-ephemeral-forks-session-branching-patterns/)) and GitButler's virtual lanes ([trigger.dev](https://trigger.dev/blog/parallel-agents-gitbutler)) define a three-rung ladder:

1. **Episode within one session** (default). Sequential work on one branch; the boundary is *declared* (green build / conventional-commit landing). No fork. Most work is this.
2. **Lane (lightweight fork)** — a `/side`-style divergence within the same session for a short experiment, no new worktree, explicit file routing (GitButler `but commit --changes`). Use when the experiment shares infra (DB, dev server, port). Represent as a `zu type:task` pointing at a virtual lane; vanishes if abandoned.
3. **Sub-session (heavyweight fork)** — `/fork`-style: a new `zz/session-<id>` branch in its **own worktree** off the parent's HEAD, isolated context window. Use when the thread is durable and needs isolation. This is Cursor's `agent/<slug>` and Claude Code's agent-teams "teammate."

**Rule of thumb:** divergence that shares infrastructure and dies within the session = lane; divergence that needs an isolated context window and may outlive the turn = sub-session. A pulse-check session (0 episodes) stays an unborn branch — confirmed correct by the `/side` convergence.

**The merge hierarchy.** Sub-sessions branch off the **session branch** (the rolling integration surface) and PR back into it — *never* directly to main (OpenHands' parent-rolling-branch model). The session branch PRs to main as the human-reviewed gate. Merge-back is a **fan-out → reduce → synthesize** protocol ([alexop.dev](https://alexop.dev/posts/claude-code-workflows-deterministic-orchestration/)): the sub-session returns only its **squash commit + episode summary** (Amp's subagent context firewall — parent never sees the child's full trace), and the **reduce step stays mechanical** (git merge-base, diff stats, build status) so it consumes zero tokens.

**Hard guarantees:**
- **Green-build gate, not just clean merge** — worktrees protect only at the filesystem level; two agents editing the same function in different worktrees pass the merge check and break the build (Nimbalyst/Crystal's explicit warning, [github](https://github.com/stravu/crystal)). Run tests before the squash lands.
- **Proactive conflict detection** via `git merge-tree --write-tree` across live branch pairs as a background `doctor` check, not at merge time (Claude-Squad's 5s daemon).
- **Resolver sub-agent** on conflict — spawn a focused session with both branches' context.
- **Explicit per-file staging, never auto-stage-all** — the agentjj inversion: the staging area is an *agent asset*, and auto-staging destroys the multi-session isolation correctness guarantee ([geirsson.com](https://geirsson.com/jj-workspaces)). zuzuu's existing "only touched files" rule is load-bearing.

**Module tie-in:** the fork/merge events become first-class entries in the Wave C session manifest, so the full branch topology is recoverable via `doctor`. The forked sub-session's conversation track feeds knowledge/memory at close; its work track feeds actions.

---

## 4. The conversation ↔ git ↔ modules linkage

zuzuu is **architecturally ahead of every surveyed harness here**, and this is the differentiator to lean into. Every competitor splits conversation from git: Cursor/Claude Code use off-git file snapshots ([cursor.com](https://cursor.com/docs/agent/chat/checkpoints), [claudelog](https://claudelog.com/mechanics/rewind/)) creating split-brain; Cline/RooCode use shadow git repos that *corrupt the real repo* on nested-`.git` workspaces ([docs.cline.bot](https://docs.cline.bot/features/checkpoints), [docs.roocode.com](https://docs.roocode.com/features/checkpoints)); Aider commits for real but has no conversation linkage ([aider.chat/docs/git](https://aider.chat/docs/git.html)). **No harness binds conversation history to git commits. zuzuu does, because turn = real commit on the session branch.**

**The flow:**

```
conversation turn ──┬─→ CONVERSATION track (all turns, transcript)
                    │        └─→ feeds Knowledge (semantic) + Memory (episodic)
                    └─→ WORK track (file-changing turns = checkpoint commits)
                             └─→ grouped into EPISODES (declared boundary)
                                      └─→ feeds Actions (procedural)

episode close ─→ squash commit (CC title + Zz-* trailers)
             ─→ session-close ENHANCE pass (transcript hot)
                  ─→ typed proposals → human gate (Useful/Misleading, approve/edit/reject/redirect)
                       ─→ promoted into the RIGHT module
```

**Routing rule** (which module a learning lands in): a *fact/convention* → Knowledge inbox; an *episodic record / decision* → Memory (AgDR-format zu); a *reusable procedure* → Actions (gated behind dry-run, §6); a *steering correction* → Instructions. Mem0's finding sharpens the miner: **agent-confirmed facts and corrections carry equal weight to user-stated facts** — the most durable knowledge is often the agent's own resolution, not the user's utterance ([arxiv 2504.19413](https://arxiv.org/abs/2504.19413)).

**Rewind / branch-from-a-past-turn, reconciled with squash.** Because turn = commit, no secondary snapshot store is needed:
- **rewind code** = `git reset` to turn N's tree on the session branch.
- **rewind conversation** = truncate the in-session messages after turn N.
- Adopt **Cline/Kiro's three-mode vocabulary** (files-only / conversation-only / both, [kiro.dev/checkpointing](https://kiro.dev/docs/cli/experimental/checkpointing/)) and Kiro's **two-tier granularity** (turn-level primary surface, tool-level sub-commits for inspection).
- **Branch-from-a-past-turn** = a sub-session forks off commit N (not HEAD) — the same fork primitive as §3.
- **Reconciliation with squash:** rewind is free *before* the episode squashes; *after* squash the per-turn history is gone and the branch is closed. This must be **documented as irreversible** (RooCode's irreversible-truncation failure is the warning). The squash is the deliberate "forget" — git preserves everything, agents must forget constantly ([GCC proposal](https://gist.github.com/odysseus0/ad36f1c24dba6d5589ff417b70cee82e)).

**Trailer vocabulary.** Extend the existing `Zz-Intent`/`Zz-Episode`/`Zz-Tests` with the Lore protocol's harvestable signals ([arxiv 2603.15566](https://arxiv.org/html/2603.15566)): `Zz-Rejected` (dismissed alternatives — what distill mines from the conversation) and `Zz-Directive` (forward warnings — what the Instructions module contributes at close). The squash commit body = the curated handoff summary; `git log --trailer` makes the whole module-harvest signal machine-parseable, and the commit graph *is* the Thread Map ([tessl.io thread-map](https://tessl.io/blog/amp-launches-thread-map-to-help-navigate-ai-coding-agent-work/)) — no separate visualization layer needed.

---

## 5. Mid-session artifacts in `.zuzuu/.live/`

The universal harness pattern is a **two-layer artifact split**: an ephemeral in-session working layer + a durable project layer, with — and this is zuzuu's structural advantage — **a principled graduation gate between them that no competitor has** (Claude Code todos evaporate, [agent-sdk/todo-tracking](https://code.claude.com/docs/en/agent-sdk/todo-tracking); Devin's `notes.txt` resets with the VM, [medium](https://medium.com/@nitinmatani22/how-devin-ai-actually-thinks-autonomous-planning-dag-execution-and-dynamic-re-planning-explained-997be175a475)).

The `.live/` working set (git-ignored, never committed):

| File | Role | Schema / pattern | Graduates to |
|---|---|---|---|
| `intent.md` | session contract | Task / Plan / Episodes / Outcome (Devin 4-slot) | Memory zu (episodic) |
| `scratch.md` | turn-level chain-of-thought | free-form, agent-written | nothing — evaporates by design |
| `todos` | in-session task list | replaced wholesale per write (Claude Code), keyed by id | episode checkpoints |
| decision stubs | architectural choices | AgDR frontmatter (id/timestamp/agent/model/trigger/status + Y-statement, [github me2resh](https://github.com/me2resh/agent-decision-record)) | Memory zu `type:decision` |
| `snapshot.md` | long-session resume | compaction snapshot (OpenCode resume hook) | seeds Wave C manifest |
| `digest.md` | the brief | regenerated each session start | — (output, not input) |

**Graduation = enhance, at close.** `intent.md` → Memory zu; selected `scratch`/transcript insights → Knowledge inbox; decision stubs → Memory `type:decision`; procedures → Actions inbox. Devin's in-session suggestion UX is the right flow: surface "I noticed X — add to knowledge?" as a *ready-to-approve proposal during the session*, not only at close ([cognition.ai sept-24](https://cognition.ai/blog/sept-24-product-update)). Kiro's bidirectional spec-code sync adds the drift case: when the work track diverges from a zu's stated intent, enhance should propose an *update* to the zu, not just append new knowledge ([kiro.dev/blog](https://kiro.dev/blog/introducing-kiro/)).

**Capacity discipline** (Hermes): when a memory file would exceed budget, the consolidation/eviction step runs *as part of enhance* — never unbounded agent-initiated writes ([github hermes-agent](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory.md)). The `.specify/` precedent confirms structured artifacts belong inside a tracked dot-dir scoped per unit ([github spec-kit](https://github.com/github/spec-kit)) — validating `.zuzuu/modules/` as the right durable home, never a parallel `docs/` tree.

---

## 6. Adopt / Adapt / Avoid

**Adopt (use the mechanism directly):**
- Digest injected as a *message*, header-first / detail-on-demand (Claude Code SessionStart + Goose progressive disclosure).
- Four-mode steering activation — `always` / `fileMatch` / `agent-requested` / `manual` (Kiro + Cursor). `agent-requested` is what auto-loads the harvest protocol.
- Generated `AGENTS.md` as the cross-host portability shim (AAIF).
- Handoff-not-compaction at close; squash commit = handoff artifact (Amp — empirically validated, 1,281 runs).
- Four-option gate (approve/edit/**redirect**/reject) + Useful/Misleading typed lanes (Warp + Devin).
- Three-mode rewind (files / conversation / both) with git as the actual store, no shadow repo (Cline vocabulary, zuzuu substrate).
- Worktree-per-sub-session, two-level branch hierarchy, fan-out/reduce/synthesize merge (Claude-Squad/OpenHands/Conductor).
- `Zz-Rejected` + `Zz-Directive` trailers for module-harvestable signal (Lore).
- AgDR format for decision zus; Devin 4-slot for `intent.md`.

**Adapt (the idea, reshaped for the observe posture + zero-dep):**
- Sprint contract → declared at session *open*, persisted as `Zz-Intent` trailer (makes episode boundaries mechanical).
- Sleep-time reorganizer → the session-close enhance pass, human-gated (Letta).
- Memory-block typing → each zu *is* a typed block; enhance *is* the reorganizer.
- GitButler virtual lanes → a lightweight "lane" fork mode *approximated with plain git + episode metadata*, not the GitButler binary.
- jj patterns (change-id→trailer, op-log→ledger) → borrow the shape, **never the binary**; the staging area is kept as an agent asset (agentjj inversion).

**Avoid:**
- Auto/recursive compaction (Amp study + Roo Code #5616).
- Shadow git repos (Cline/RooCode corrupt nested `.git`).
- Off-git file snapshots (Cursor/Claude Code split-brain).
- Auto-staging all changes (destroys multi-session isolation — agentjj).
- Ungated conversation→memory extraction (Cursor *deprecated* it within a release).
- Merging Instructions and Knowledge modules (drift — Claude Code field lesson).
- Sub-tasks PR-ing directly to main (bypasses the session integration surface).
- LLM-generated agentfiles / the digest authored by an LLM — assemble it mechanically from gated content (ETH Zurich study, via HumanLayer).
- Unlimited parallel teammates — coordination cost exceeds benefit past ~5-6 threads (Claude Code team finding).

---

## 7. Open risks

**Observe-vs-drive — we may not control the host conversation.** This is the deepest tension. The start ritual (inject digest as message), the in-session `<summary>` block, the `Esc Esc`/`Enter Enter` steering, and rewind-conversation all assume control over the host's message stream — which we *don't have* under the observe posture for Claude Code/Codex/etc. **Mitigation, already in the design's grain:** lean on the surfaces we *do* control — git (turn=commit is host-agnostic), `.zuzuu/.live/` files, the SessionStart hook (which every host exposes), and the guardrails `PreToolUse` gate. The conversation-level mechanisms (per-turn summary, rewind-conversation) are **drive-harness features (pi, Stage 3)**; under observe they degrade to *git-only* equivalents (rewind = git reset; "summary" = reconstructed from commit messages by `doctor`). Be explicit in the design about which mechanisms are observe-available vs drive-only, so we don't ship a contract the host can't honor. The `digest-as-message` weight advantage specifically only holds where the host injects SessionStart content into context (Claude Code does; not all do) — fall back to the AGENTS.md/file-read path elsewhere and accept the lower weight.

**Complexity creep.** The fork spectrum (episode/lane/sub-session), four steering modes, four-option gate, typed enhance lanes, extended trailers, and `.live/` artifact set are individually justified but collectively a lot of surface. **Discipline:** ship the **episode-only path first** (most work never forks); make lanes and sub-sessions *opt-in* additions, not the default. Keep the always-on layer under 150 lines (the budget is the forcing function). Apply the **ratchet** to zuzuu's own surface — every mechanism added must trace to an observed need, not a competitor's feature. The two-tier artifact split is the simplifying spine: ephemeral `.live/` working files + durable gated `.zuzuu/modules/` zus, with enhance as the single graduation gate. Everything else hangs off that spine; resist any mechanism that doesn't.

**Rewind-after-squash irreversibility.** The episode squash is a deliberate, lossy "forget." Document it loudly (RooCode's irreversible-truncation backlash); offer a pre-squash confirmation and ensure `doctor` can still reconstruct the episode's intent from the trailer even after the per-turn history is gone.

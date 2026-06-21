# Research: Conversation-planning architecture — direction validation

> Persisted prior-art research synthesis (workflow `wf_a0e7d2e9-ebf`). Validates zuzuu's intent-stack / episode / steering model against compound-engineering, spec-driven dev, plan-execute agents, dialogue-state, compounding loops, and HITL gates. Background reasoning — not canon.

---

This is a synthesis task — I have all seven research angles already provided. No tools needed; I'll write the brief directly.

# zuzuu Conversation Architecture — Validation & Pattern-Adoption Brief

## 1. Direction verdict: you are on the right track

The field **validates zuzuu's core architecture convergently** — not from one source, but across compound-engineering, the 2025-2026 spec-driven frameworks (Kiro/Spec-Kit/BMAD/Tessl), the plan-execute literature (Plan-and-Act, ADaPT, HTN), dialogue-state-tracking, and the compounding/self-improvement research (Reflexion/ExpeL/Voyager/ERL). Every one of the five design bets has independent prior art confirming it.

**Where you are RIGHT (confirmed):**

| Bet | Confirming prior art |
|---|---|
| **session = branch = conversation (1:1)** | ce-work creates one branch/worktree per task ([compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin)); every framework scopes one durable state object per thread (LangGraph threads, OpenAI Conversations API) |
| **two tracks (conversation → Knowledge/Memory; work → commits → Actions)** | "plan body never mutated during execution; progress lives in git commits" (ce-work); execution primitive vs state primitive are separate objects everywhere (OpenAI [Responses/Conversations split](https://developers.openai.com/api/docs/guides/conversation-state)); ExpeL's two-tier abstract-rules-vs-trajectories |
| **episode = pursuit of ONE objective, defined by intent transition (not commit)** | ES-Mem / HiMem ([arXiv 2601.07582](https://arxiv.org/abs/2601.07582)) find *semantic/topic* transitions, not action completions, are the correct boundary; InterruptBench confirms intent-as-unit; SWE-agent trajectory = the unit of learning |
| **reverted/discovery episode = richest signal** | ERL ([arXiv 2603.24639](https://arxiv.org/html/2603.24639v1)): failure-derived heuristics beat success-derived by **+14.3%**; SWE-agent: failure trajectories are 12-82% longer (more structure to harvest); Reflexion's whole thesis |
| **steerable objective stack in a file (intent.md)** | Goal-drift research ([Zylos 2026](https://zylos.ai/research/2026-04-03-goal-persistence-drift-long-horizon-ai-agents)): "goals that live outside the context window and are actively retrieved remain effective"; Plan-and-Act's plan-as-working-memory; InfiAgent/Mem0 |
| **human-gated enhance loop** | THE differentiator — every automated system surveyed (ce-compound, Hindsight, ERL, AgentFactory, ExpeL) hits **knowledge poisoning** from false reflections; Reflexion's 2025 blind-spot finding (same model generates output + critique) is exactly what the gate kills |

The strongest external signal: **the live forward intent stack has NO equivalent in compound-engineering** — ce-sessions is purely retrospective. zuzuu is building genuine differentiation, not catching up. [Will Larson's critique](https://lethain.com/everyinc-compound-engineering/) confirms the bet: compound-engineering is "temporary scaffolding" patching the absence of a native enhance loop; **zuzuu IS that native loop.**

**Where you are WRONG or naive (corrections, in priority order):**

1. **intent.md conflates three timescales that proven systems keep separate.** Kiro (product.md/tech.md/structure.md steering + requirements/design/tasks), BMAD (project-context.md + story files), and compound-engineering (STRATEGY.md + plan + tasks) all enforce a **three-layer split**: stable strategy / per-session plan / per-turn tasks. zuzuu's monolithic intent.md needs splitting → stable `.zuzuu/instructions/` (steering) + per-session `.zuzuu/.live/intent.md` (objective stack) + an episode-level task sub-list. **This is the single most-cited correction (4 of 7 angles).**

2. **intent.md should be REWRITTEN at every turn, not only appended on explicit steers.** Plan-and-Act ([arXiv 2503.09572](https://arxiv.org/html/2503.09572v3)) regenerates the remaining plan after *every* executor step — "the plan IS the working memory." A stale intent.md between turns is a documented drift vector (Zylos "Context Dilution" / "Subgoal Displacement"). The cheap version: a "plan still valid?" heuristic check at turn close, not a full LLM replan.

3. **The objective stack must have a machine-readable typed section, not just prose.** Every production system that tried free-text goal state found it unreliable for automated transition detection. Add YAML/JSON front-matter (or `intent.json`) with typed episode records (status: pending/active/done/reverted/superseded/abandoned) — mirrors BMAD's `sprint-status.yaml` and Spec-Kit's `T001` checkboxes. The human reads prose; the agent writes status.

4. **Missing Stop Rules.** The [Intent Engineering Framework](https://www.productcompass.pm/p/intent-engineering-framework-for-ai-agents) (Objective + Outcomes + Constraints + Autonomy Zones + **Stop Rules**) shows each objective needs an explicit halt/escalate condition, not just an outcome type. Currently zuzuu specifies *outcomes* but not the *decision rule* for escalate-vs-continue.

5. **"Useful/Misleading" typed feedback is unvalidated.** No surveyed system implements this dual-label rating (Devin uses severity color-codes; ce-compound has no rating). **Keep it only if it maps to a downstream behavior** — i.e., Misleading → decrements a per-miner trust weight in `eval`. Otherwise it's a UI verb that adds gate friction with no payoff. Make it optional metadata, not a required gate action.

---

## 2. The conversation-planning pattern to adopt

The canonical flow, synthesizing compound-engineering + spec-driven + plan-execute. Each step names the proven pattern to borrow:

| Step | Borrow from | Mechanism |
|---|---|---|
| **1. Greet + recap + nudge** | STRATEGY.md / digest read at skill start (ce-strategy, BMAD project-context.md) | Read the steering layer + last session's outcome before anything. zuzuu's generated digest is *strictly better* than hand-written STRATEGY.md — but should include a synthesized "Current Tracks" section, not raw instructions |
| **2. Scope checkpoint (blocking)** | **ce-plan Phase 0.7** ([ce-plan SKILL.md](https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/skills/ce-plan/SKILL.md)) + ce-brainstorm 4-gap Product Pressure Test | Present inferred objective + decision-forks → **block** on user confirmation BEFORE any work. The reply IS the intent.md write. Probe vague objectives for evidence/specificity/counterfactual/attachment gaps |
| **3. Write objective stack** | Kiro three-file spec + Spec-Kit T001 numbering | Objective stack = the "what" layer; each objective carries a verification criterion (its episode's done-test). Repo-relative file refs (portable across worktrees, matching Wave C) |
| **4. Episode execution** | **ADaPT lazy decomposition** ([arXiv 2311.05772](https://arxiv.org/abs/2311.05772)) + ReAct inner loop + HTN two-level | Attempt the objective directly; decompose into sub-episodes only on failure (lazy beats eager by 27-33%). Turns = work-track primitives; episodes = intent-track units. **GATE (from LFG):** an episode cannot enter execution without a written checkpoint in intent.md — "plan-file-must-exist-before-code-changes" |
| **5. Episode close** | LFG `<promise>DONE</promise>` signal | Make the outcome an **explicit structured signal in the transcript** (`<episode outcome="reverted" id="..."/>`), not inferred from git state. Explicit termination is the right interface between work and the knowledge loop |
| **6. Enhance at session close** | **ce-compound** (auto-trigger on "that worked") + parallel extraction | Fire automatically from the SessionEnd hook (not a separate command). Run miners concurrently. Produce typed proposals routed to the correct module. Human gate as batch |

**Hard warning (Scott Logic postmortem on Spec-Kit):** the full specify→plan→tasks→implement waterfall generated **2,577 lines of markdown per feature, 57.5 agent-minutes vs 8 for iterative prompting**, and still let a bug through with no recovery path back to the spec. **zuzuu's "lazy" session model is the right corrective** — keep the front-load light; let episodes compound knowledge organically. Do NOT adopt the heavyweight upfront spec ceremony.

---

## 3. Dynamic re-planning / steering

This is your differentiation and the hardest part. Even **Devin handles mid-task steering poorly** — its [2025 performance review](https://cognition.com/blog/devin-annual-performance-review-2025) admits it "usually performs worse when you keep telling it more after it starts." zuzuu's intent.md-as-state-changing-event is the correct architectural answer to exactly Devin's gap.

**The borrowed mechanism — `replan_node` from LangGraph Plan-and-Execute** ([planning-agents](https://www.langchain.com/blog/planning-agents)): a steer is a first-class code path that receives `(active_objective, intent.md, episode_history[])` → emits a revised intent.md with the old objective marked superseded and a new one opened. Make this a real path, not a special case.

**Detect the steer as a distinct signal class.** InterruptBench ([arXiv 2604.00892](https://arxiv.org/pdf/2604.00892)) names the #1 steerability bug: agents that "treat the interrupt as a surface-level message rather than a state-changing event." Successful agents "explicitly detect intent drift, retract the previous assumption, trigger a recomputation."

**Handle the steer by type — adopt the Addition/Revision/Retraction taxonomy** (InterruptBench), which is architecturally load-bearing:

- **Addition** (new requirement) → push onto stack, prior objective persists
- **Revision** (correction) → may reuse prior work
- **Retraction** (remove over-constraint / "that failed, undo") → the expensive case: **git reset + close active episode + open new one + realign environment**. The state-reconciliation step (env to match post-steer intent) is the documented bottleneck — make it explicit, not implicit.

**The outer-loop reset** (Microsoft [Dual-Loop](https://datasciencedojo.com/blog/agentic-loops-explained-from-react-to-loop-engineering-2026-guide/)) handles discovery-driven reverts: when the inner loop stalls (N failures), the outer loop closes the episode as `reverted`, writes a "tried X, avoid because Y" zu, and opens a fresh episode. zuzuu's git state already IS the file-based persistent memory this pattern needs.

**Cumulative belief propagation** (DST frame/slot model): once an objective is on the stack it persists until *explicitly* transitioned — a newly stated objective does NOT silently replace the prior one. This is exactly the stack discipline that prevents intent drift.

---

## 4. The compounding loop

What enhance should borrow:

**From ce-compound** ([ce-compound.md](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/skills/ce-compound.md)):
- **Two-template split** → route proposals: **Bug Track** (Symptoms / What Failed / Solution / Prevention) = reverted-episode "avoid X" → Memory/Knowledge; **Knowledge Track** (Context / Guidance / When-to-Apply / Examples) = discovery "know Y" → Knowledge.
- **Overlap-scoring dedup gate** → before writing a new proposal, scan existing items for 4+ dimension overlap → update rather than create (4-5 dims = update; 2-3 = new+flag; 0-1 = new). Prevents the junk-drawer failure.
- **Discoverability propagation** → when a learning lands, auto-check that digest.md references its category, or the agent won't find it next time.
- **Auto-trigger** on session-end hook, not a manual command — making enhance feel like extra work is the death of the loop.

**From ERL + Reflexion:** adopt the **structured heuristic format** — *trigger condition + recommended action* ("when sending email, resolve names via Contacts first") rather than free-form "we learned X." This makes knowledge items directly actionable. Treat **reverted episodes as higher-priority proposals** (the +14.3% / 12-82% signal) — not equal to successes. This is *not yet explicit* in zuzuu's design and should be.

**From Voyager** ([voyager.minedojo.org](https://voyager.minedojo.org/)): **store-only-after-verification** — an Action proposal is approved only after the agent demonstrates it ran correctly. **Composition** — Actions can call Actions by name. **Add a curator pass** (use_count, archive stale) — Voyager's lack of pruning is its named weakness.

**From Generative Agents:** the **importance/corroboration threshold** — surface a proposal when N corroborating sessions see the same pattern, not on every occurrence. This is the formal mechanism for the guardrails miner's existing cross-session-corroboration requirement.

**From MemTier (the missing mechanism):** the **cognitive-weight attribution loop** — when a proposal is approved Useful, increment a weight on the source trace sessions; when rejected Misleading, decrement. This makes the observe→distill→propose→review loop self-improving *without extra labeling*, AND gives "Useful/Misleading" the downstream behavior it currently lacks (§1 correction 5).

**When:** per-session at close (every framework converges on per-task, not per-turn — per-turn is too noisy for durable compounding).

---

## 5. The human gates

Three gate moments map onto the [converging industry tiering](https://galileo.ai/blog/human-in-the-loop-agent-oversight) (pre-execution / synchronous / asynchronous-post-hoc):

| Gate | When | Verb set | Source |
|---|---|---|---|
| **Start: objective approval** | pre-execution, blocking, brief | approve / edit / redirect | ce-plan Phase 0.7, Codex whitelist, Claude plan-mode |
| **Mid: steering** | synchronous interrupt | **approve (continue) / edit (modify objective) / reject (revert/abandon) / redirect (supersede)** | [Warp four-verb set](https://www.warp.dev/blog/reimagining-coding-agentic-development-environment) — maps exactly to objective-stack ops |
| **Close: enhance proposals** | async, **batch** | approve / edit / reject / redirect per proposal | ce-compound consent gate, [aipatternbook Batch Review](https://aipatternbook.com/approval-fatigue) |

**Fatigue avoidance — the load-bearing rules:**

- **Batch the enhance gate. Never one proposal per interrupt.** LangGraph's own guidance: "a graph that interrupts on every LLM call trains humans to rubber-stamp." DeepMind's "AI Agent Traps" (2025) names the five fatigue symptoms.
- **The approved objective stack is an envelope** (Codex whitelist / Warp allowlist): mid-session tool calls *within* the envelope don't re-prompt; only *deviations* surface as gates.
- **Reversibility drives friction asymmetry:** a Knowledge proposal is soft/correctable → low friction; a Guardrails rule change is in-effect-immediately/irreversible → high friction (explicit confirm + label).
- **Hold the whole gate surface to a 10-15% escalation rate** ([Changkun](https://changkun.de/blog/ideas/human-in-the-loop-agents/)). More than that = miscalibrated guardrails/miners, not better safety.
- **Track "override rate"** (fraction of enhance proposals rejected) as the eval metric for miner quality — **>30% = miners producing noise**, recalibrate eval ranking, don't add gates.

**Two genuine architectural advantages to call out in design docs:**
1. zuzuu's guardrails gate is a **real PreToolUse tool restriction** — Claude plan-mode's "readonly" is merely prompt-enforced. The plan-mode model is weaker than it appears.
2. The human gate is the **only** defense against knowledge poisoning that every automated competitor lacks. This is the moat.

---

## 6. Adopt / adapt / avoid

**ADOPT (proven, low-risk, directly mapped):**
- `replan_node` steer path: steer → `(objective, intent.md, history)` → revised intent.md (LangGraph)
- Addition/Revision/Retraction steer taxonomy with explicit git-reset state-reconciliation for Retraction (InterruptBench)
- Explicit episode-outcome signal in transcript (`<episode outcome=.../>`), LFG-style — not git-inferred
- Bug Track / Knowledge Track proposal split + overlap-scoring dedup (ce-compound)
- Structured heuristic format (trigger + action) for knowledge items (ERL)
- Reverted-episode = higher-priority proposal (ERL/SWE-agent)
- Batch enhance gate; envelope-based mid-session auto-approve; reversibility-driven friction (aipatternbook/Codex/Warp)
- Auto-fire enhance from SessionEnd hook (ce-compound)
- 10-15% escalation + override-rate eval metrics (Changkun/Galileo)

**ADAPT (right idea, needs zuzuu-specific shaping):**
- Split monolithic intent.md → instructions/ (steering) + .live/intent.md (stack) + episode tasks layer (Kiro/BMAD)
- Add machine-readable `intent.json` / YAML front-matter alongside prose (BMAD sprint-status.yaml)
- Rewrite intent.md at turn close via cheap "still valid?" heuristic, not full LLM replan (Plan-and-Act)
- Add Stop Rules per objective (Intent Engineering Framework)
- "Useful/Misleading" → wire to per-miner cognitive-weight in eval, else drop (MemTier)
- Lazy ADaPT decomposition for sub-episodes; store-after-verification + curator pass for Actions (Voyager)
- Three-tier digest: synthesized Current Tracks + abstract knowledge tier + concrete memory-episode tier (ExpeL/STRATEGY.md)

**AVOID:**
- Heavyweight upfront spec/plan/tasks waterfall (Scott Logic: 2,577 lines, 57min, bug still slipped)
- Per-proposal gating (rubber-stamp trap)
- Unbounded organic task generation (BabyAGI: prioritization drift with no gate)
- Reflexion-style within-session retry loop (blind-spot self-reinforcement + latency)
- Free-text-only goal state (unreliable for transition detection)
- Treating a steer as a normal conversation turn (the #1 steerability bug)

---

## 7. Open risks

**Observe-vs-drive tension (the structural risk).** The richest steering mechanisms (LangGraph `interrupt()`/`Command(resume=)`, Plan-and-Act's per-turn replan, the replan_node code path) all assume you **drive** the loop. In **observe** posture (Claude Code/Codex) you cannot inject `Command(resume=)` mid-node — you can only observe the transcript and write intent.md, hoping the host's next turn re-reads it. **Consequence:** turn-boundary re-anchoring and explicit episode-outcome signals depend on the host's cooperation (re-reading intent.md, emitting the structured outcome tag) — which you cannot enforce while observing. Mitigation: the SessionStart/turn hooks regenerate intent.md and inject it (you already do this for digest); the explicit-outcome-signal becomes a *requested convention* in observe mode and an *enforced gate* only under the pi drive harness later. Be honest in design docs that **full steering robustness is gated on the drive harness** — observe mode gets a degraded (re-anchor-and-hope) version.

**Complexity creep (the adoption risk).** The corrections pull toward more files (instructions/ + intent.md + intent.json + episode task lists + Stop Rules + cognitive-weights). This contradicts the zero-dep, "a first-time reader can read the whole repo" ethos. Discipline: intent.json should be *generated/maintained by the turn hook*, not hand-authored; the three-layer split should reuse the existing module home (instructions module already exists) rather than invent new surfaces. The Spec-Kit postmortem is the cautionary tale — structure that doesn't pay for itself in the same session is overhead. Gate each addition on: does an episode close better because of it?

**The "Useful/Misleading" overhang.** If you keep the label without wiring it to eval weights, you've added gate friction researchers found in *no* successful system. Either wire it (MemTier attribution) or cut it.

**Intent-stack-as-novel-mechanics.** The live forward intent stack is your differentiation precisely *because* it has no external prior art validating its specific transition mechanics. Build it with confidence, but the episode-boundary-detection rules (dual-signal: explicit intent transition + surprise/revert) are the part most likely to need empirical tuning against real traces — instrument it and treat the first N sessions as calibration data, not finished design.

# Core Hypothesis & Evolving Faculties

> **Status:** design, 2026-06-03 (tools-evolution ladder refined 2026-06-04). Deepens [`agentic-platform-concept.md`](agentic-platform-concept.md); grounded in the audited survey [`inspiration/agent-harness-survey.md`](inspiration/agent-harness-survey.md) + a deep research pass on tool evolution.
> **Decisions:** Agent = *durable entity, episodic runs* · promotions *proposed by an automated trace-miner, disposed by a human* · covers all five primitives (agent definition, tools evolution, memory evolution, per-faculty evals, guardrails).
> **Differentiator vs paperclip / pi-dev:** their agents are static BYO runtimes; **ours graduate** — faculties self-improve under human-gated generational promotion.

## Context
The platform's core hypothesis is **generational graduation**: an agent's components (memory, tools, prompt, guardrails) improve over versioned generations, and a **human sits in an async, out-of-band loop** to evaluate and promote them. The user's pi-dev/Bidev intuition — "start minimal, grow/upgrade tools over time" — is the missing piece. Memory's *substrate* ladder is designed; the **evolution of faculty contents** is not. This doc defines the agent entity, the unified promotion engine, and how memory + tools + guardrails + evals plug into it.

---

## 1. The two axes (the crux — do not fuse them)
Every faculty evolves on **two independent axes**:

| Axis | What evolves | How it changes | Status |
|---|---|---|---|
| **Substrate** | *how* a faculty is implemented | **set** by an operator (a tier choice, behind a stable interface) | already decided |
| **Contents / capability** | *what* a faculty has accumulated + its promotion to richer forms | **earned** from trace data via a governed pipeline | **the new design** |

- Memory substrate (*power over accumulated facts*): `md → relational → graph → vector`. Tools substrate (*selection/composition power over the tool set*): `single → agent-decided → schema-assisted → semantically-retrieved → crystallized → service` (§5).
- Memory contents: raw episode → extracted fact → typed relation (extraction, entity-resolution, reflection).
- Tools contents: ad-hoc trace sequence → named tool → upgraded/versioned tool (**crystallization**).

**The true symmetry — and the core hypothesis — lives on the contents axis:** memory's episodic→semantic promotion and tool crystallization are *the same governed pipeline* (§3). One trace feeds both; one human gate; one unit of versioning (the generation). **Both substrate ladders expand *power over accumulated stuff* and converge on the vector tier** (memory: semantic recall; tools: semantic tool-selection — same pgvector substrate). A substrate jump only counts as evolution if it *changes what the agent can do* — which is why code-organization (script→OOP→package) is **hygiene, not a rung** (§5).

---

## 2. The Agent entity — durable, with episodic runs
Two levels, distinct lifetimes:

- **Agent (durable):** identity, role/title, reporting position, **active-generation pointer**, generation lineage, attached faculty refs (Memory + Tool entities, M:N), budget policy. Persists; accumulates competence; *graduates*. It is an **employee, not a script** — it never "finishes."
- **Generation (immutable pin — the lockfile):** `{ system_prompt (+hash), model, tool refs+versions, memory refs+schema-versions, input_guardrails, output_guardrails, budget envelope }`. AutoGPT model: immutable version rows + `isActive` pointer + `forkedFrom`; **rollback = flip the pointer**. lobe-chat `promptHash` drift guard.
- **Run / Episode (transient):** one invocation under a generation = a **bounded goal-loop**. Composable termination (autogen-style): `goal-reached` (typed end-turn tool) **OR** `budget-envelope-zero` **OR** `max-rounds/stall` **OR** `waiting-for-human`. Emits a **trace** (tree of typed spans). Runs are the substrate for evals + promotion mining — *not* a generation (pin definitions, observe data).

**Answer to "goal-loop or something else?":** *both, at two levels.* A run is a bounded goal-loop; the agent is a durable evolving entity that *has* runs. The agent is defined by **role + faculties + guardrails**, not by a single goal.

---

## 3. The unified promotion engine (the core hypothesis, made concrete)
One pipeline, applied per faculty. **Trace-miner proposes; human disposes; approval pins a new generation.**

```
observe (trace spans)  →  eval (score the faculty's operations)  →
  trace-miner detects a promotion signal  →  files a Proposal  →
    human approves (async, out-of-band, in an inbox)  →  pin as new generation
```

- **Proposal** = new first-class entity: `{ faculty, kind, trigger_signal, evidence (trace refs + eval scores), suggested_diff, status: pending|approved|rejected }`. The bridge from observability to generation.
- **Async + human-gated, never auto in v1.** Crystallization-from-traces is the *same research-grade problem* as the auto-harden loop already cut (reward-hacking/overfit). The async human loop *is* the safety boundary. (lobe-chat nightly approval-gated proposals; cognee/agno `SkillImprovementProposal`.)
- **Auto-implement deferred** (L4), exactly as the concept doc states.

---

## 4. Observability-driven evals → the trigger→proposal map (the real deliverable)
"Observability-driven evals for tools and memory as subcomponents" = a per-faculty **eval lens** (scores operations in the trace) feeding a **signal→proposal** table the trace-miner runs.

**Eval lens (operation-level, from trace spans):**
- *Tool eval (per tool-call span):* right tool chosen? args valid vs schema? succeeded? effect within declared class? latency/cost within budget? → aggregate = **tool health per generation**.
- *Memory eval (per memory-op span):* right query/params? read hit/miss? write ok? entity-resolution hit/miss? → aggregate = **memory health per generation**.
- One unified **Score schema** (langfuse/phoenix): `source {HUMAN, AUTO, API}`, typed, attached to a span. Eval set = curated production traces → regression across generations.

**Trigger → proposal map:**

| Faculty | Trace signal | Proposal kind |
|---|---|---|
| Tools (contents) | high failure / malformed-args rate on a tool | **upgrade** (regenerate/fix) or **tighten schema** |
| Tools (contents) | agent improvises an action with no matching tool | **acquire / author** a new tool |
| Tools (contents) | never-used / low-use tool in the set | **retire** (prune → smaller prompt) |
| Tools (substrate R1→R2) | chaining / arg-mismatch errors; agent picks incompatible tools | add typed contracts + **compatibility graph** + tags/groups |
| Tools (substrate R2→R3) | catalog size > prompt budget; wrong-tool-selection rate ↑ | add **retrieval layer** (embed intent+schema; sibling to memory's pgvector) |
| Tools (substrate R3→R4) | recurring tool **sequence** across runs | **crystallize** the chain → one named composite tool (a typed DAG) — *contents ⋂ substrate meet here* |
| Tools (substrate R4→R5) | composite reused across agents / heavy load | extract a shared **service** |
| Memory | entity-resolution miss (dup created) | **dedup-rule / schema** fix |
| Memory | recall empty when it should hit | **extraction gap** (promote episode→fact) |
| Memory | hot relation slow on L1 | **substrate-promote L1→L2 (graph)** — earned by query pattern |
| Memory | fuzzy queries failing exact match | **substrate-promote → L3 (vector)** |
| Memory | stale / contradictory facts | **reflection / GC** |

Note: substrate promotions (the "set" axis) become **earned** here — a query pattern *justifies* the tier jump, rather than an operator guessing. That's how the two axes reconnect without fusing.

---

## 5. Tools as an evolving faculty (the primitive of focus)

**Contents axis** (*what tools exist*; changes results): `ephemeral action → mined candidate → proposal → approved → named tool (v1) → generalize → upgrade (v2…) → deprecate/retire`. Versioned immutably (babyagi `Function → FunctionVersion`; `activate_function_version` = rollback); a generation pins specific tool versions, so a tool upgrade is a generation event the agent opts into. Self-authored tools (claude-engineer) are *proposals*, not live mutations.

**Substrate axis** (*selection/composition power over the tool set*; changes results) — a **selection-burden ladder**: the work of selecting & composing tools shifts **off the agent onto structure** as the toolset grows. Grounded in the actual Labs tool model (a `def main(args)` script with JSON-Schema `inputs_schema`/`outputs_schema`).
```
R0  Single tool                    — no selection problem.
R1  Many · AGENT-DECIDED            — flat catalog; the LLM picks by name.                 [Labs today]
R2  Many · SCHEMA-ASSISTED         — typed I/O drives it: a compatibility graph (whose outputs
                                     satisfy whose inputs) makes chains mechanical & typecheckable;
                                     tags/groups scope the set.
R3  Many · SEMANTICALLY-RETRIEVED  — catalog outgrows the prompt; embed intent+schema, retrieve
                                     top-k for task/context. (vector → sibling to memory's pgvector)
R4  Composed · CRYSTALLIZED        — a proven recurring chain → ONE named composite tool
                                     (its own I/O schema), versioned. Multi packaged as single.
R5  Tools-as-SERVICES              — mature composite extracted to a shared, scaled, versioned service.
```
- **The agent always decides** — structure only *narrows & validates* its choice-space: free-pick (R1) → schema says which tools may legally follow which (R2) → retrieval narrows what it even sees (R3) → a crystallized composite collapses a chain into one choice (R4).
- **R2 is nearly free on Labs** — it just *uses* the `inputs_schema`/`outputs_schema` already stored (`lib/tool-definition.ts`, `lib/schema-json.ts`): build a **compatibility graph** (typed, typecheckable edges) + tags/groups. Composition becomes *verifiable* instead of guessed. This is the immediate next step.
- **Composition appears twice, deliberately:** R2 = *ad-hoc* chaining (agent assembles, schema validates); R4 = *crystallized* chaining (a proven chain saved as a named tool). R3 sits between because retrieval is needed once the catalog outgrows the prompt — only *then* does crystallization pay off.
- **R4 is where the two axes meet:** the contents-axis `crystallize` lands exactly here.
- **Code-organization** (`single script → modules → OOP → architected package`) is **hygiene, NOT a rung and NOT a generation** — it is behavior-preserving (that's why golden-replay can verify it); a substrate jump only counts as evolution if it *changes what the agent can do*.

**Composition representation — a declarative typed DAG (decided).** A composed/crystallized tool is *not* generated code; it is a stored DAG: `{ nodes: tool-refs (pinned versions), edges: typed output→input wirings }` + its own outer `inputs_schema`/`outputs_schema`.
- *Typecheckable:* an edge is legal iff `source.outputs[field]` type satisfies `target.inputs[field]` — the R2 compatibility graph *is* the edge-validity rule.
- *Inspectable & diff-able:* a readable graph, versioned as a generation; rollback = flip the pointer. Runs on the executor with **parallel dispatch** of independent nodes (LLMCompiler); selection is **context-conditioned** on prior tools (Gorilla), not query-only.
- *Crystallization writes this graph:* the trace-miner extracts the recurring sub-DAG and stores it as a composite — no opaque blob.
- *Reuse:* this is **Flow Engine's node/graph data model + tree-walking executor** (the third merged project) — a composite tool is a mini-flow; it *converges with the agent org-chart canvas* (same graph primitive, different scale).
- *Escape hatch (deferred):* if a composition needs real control-flow (branches/loops/transforms) a DAG can't express, drop to a generated Labs script verified by golden-replay. Not in v1.

**How a rung is climbed.** Same engine (trace-miner proposes → eval scores → human disposes → pin), per the §4 climb-table. Two safety refinements: (a) crystallization/authoring is gated by **staged validation** — interface → signature → contract → golden-replay (generated tools commonly have interface bugs); (b) the eval that gates a promotion uses an **independent verifier** (proposer ≠ scorer) to avoid confirmation bias.

**Verification splits** (a consequence of the above): **capability evolution** (contents promotions + substrate R-jumps) is **eval-gated** — results *should* improve; **hygiene** (code refactor) is **golden-replay-gated** — results *must* stay identical.

**Bottom rung:** an agent ships with minimal scaffolding (a handful of built-ins) and *earns* its toolset through graduation — the pi-dev / Voyager arc, made governed.

## 6. Memory as an evolving faculty (symmetric, restated)
**Contents axis:** `working-state → mined candidate fact → proposal → approved fact/relation → schema/tier promotion → archive/forget`. Extraction + entity-resolution as a built-in sub-process (mem0/graphiti); reflection promotes episodes→semantics; the gatekeeper (lobe-chat) governs extraction cost.
**Substrate axis (recap, decided):** `L0 md → L1 relational → L2 AGE graph → L3 pgvector`, behind `remember/recall/relate`. Tier jumps now **earned** via §4 signals. **L3 pgvector is the same substrate tools' R3 retrieval reuses** — memory and tools converge at the vector tier (semantic recall / semantic tool-selection).

## 7. Guardrails in the agent definition
Input + output guardrails are **part of the pinned generation** (versioned, eval-gated, diffable like prompt/tools):
- *Input:* prompt-injection scan, PII scrub, task-input schema validation.
- *Output:* output-schema validation, moderation, redaction-before-persist, policy checks.
- **Implemented as inspectors in one ordered gate pipeline** (goose `ToolInspectionManager` / mastra processors): each returns `Allow / Deny / RequireApproval`; `RequireApproval` → `waitForEvent` pause → approval inbox. Each check is a **GUARDRAIL span** on the trace (so the safety trail = the execution trace). A guardrail change = a new generation.

**Tools are a first-class attack surface** (evolving/self-authored tools make this acute — the research is emphatic: self-evolving agents drift, and tool descriptions/retrieval are injectable):
- Treat all **self-authored + imported (MCP) tools as untrusted** — **sandbox by default** (Labs Containers + DO), tool **provenance** required, execution hardening (block secret/env enumeration; redact secrets before they hit the trace).
- **Code-review-on-promotion:** a crystallized/authored tool passes staged validation (interface→signature→contract→golden-replay) *and* a human review before it is pinned.
- **Retrieval-poisoning defense at R3:** multi-signal ranking (description + usage + provenance), not embedding-similarity alone, so a planted tool can't occupy a semantic neighborhood.
- **Eval-gaming awareness:** an agent can behave under eval and drift in production — so evals run on *unseen* curated traces, and the verifier is independent of the proposer.

---

## 8. v1 scope & cuts
**In v1:** the Agent/Generation/Run entities; the **Proposal** entity + a human **promotion inbox** (async); the trace-miner with the §4 signal set (start with the cheap, unambiguous ones — *retire unused tool*, *high tool-failure*, *entity-resolution miss*); operation-level eval lens for tools + memory; guardrails-in-generation via the inspector pipeline; tool + memory versioning feeding the generation pin.
**Deferred:** auto-implement / auto-crystallize (always human-gated in v1); agent-self-proposal (trace-miner only first); adversarial guardrail hardening; multi-agent promotion (per-system evolution) — single-agent graduation first.

## 9. Critical files / where it lands
New concept doc `docs/core-hypothesis-and-evolving-faculties.md` (this, promoted). It informs the eventual schema (`Agent`, `Generation`, `Faculty`, `Proposal`, `Score`, `Trace`) and the UI surfaces already built: **generations/evals** (version history, scores, diffs, promote/rollback), **dashboard** (the async promotion inbox = the existing approval-inbox pattern), **agent detail** (Evolution tab already prototyped → becomes the per-agent graduation history), **tools/memory** (faculty + version views).

## 10. Verification
This is a design doc — verification = the next session decomposes the **first vertical slice of the engine**: run an agent → emit a trace → run the tool+memory eval lens over it → the trace-miner files one *retire-unused-tool* or *high-failure-upgrade* proposal → it appears in the promotion inbox → human approves → a new generation is pinned with the changed tool-set → the Evolution tab shows gen N→N+1 with the eval delta. That slice proves the whole loop end-to-end.

## Open questions (non-blocking)
- Trace-miner: rules-based first (n-gram recurrence, failure-rate thresholds) vs an LLM-judge pass over traces. Start rules-based; LLM-judge for fuzzy signals (crystallize) later.
- Proposal granularity: per-signal proposals vs a batched "graduation review" per agent per cadence (lobe-chat nightly). Lean batched/scheduled to match the async-human-loop cadence.
- Does a memory *substrate* promotion (L1→L2) need its own migration story per agent, or is it a fresh-tier rebuild from retained facts? (Likely rebuild — cheaper, matches "fixtures+traces" stance.)
- **Tools R3 index:** same pgvector store as memory L3 or a sibling index — likely sibling, shared substrate code.
- **R2 compatibility graph:** structural schema-match only, or LLM-judged semantic compatibility too.
- **Trace schema:** must capture per-tool **input+output per call, tagged by tool+version**, replayable — it powers both the eval lens and golden-replay; side-effecting tools use `mode=replay`.

---

## Appendix — prior art (what we borrow)
Patterns grounded in well-established work (verified, real):
- **Voyager** — a skill library that grows as code + embeddings, retrieved top-k, self-verified → the contents-axis crystallize + R3 retrieval arc.
- **LATM** ("LLMs as Tool Makers") — expensive-maker / cheap-user split → the *economic case* for crystallization (author once, reuse cheaply).
- **CRAFT** — validate → dedup → abstract → the crystallization promotion recipe; **ToolLibGen** — refactor + a reviewing agent ensures functional parity → our hygiene + golden-replay.
- **DSPy / LLMCompiler** — typed module composition + planned parallel-DAG tool execution → R2/R4 composition as a DAG.
- **ToolGen / ToolkenGPT / Gorilla / Tool2Vec** — tool-selection at scale = vector retrieval over tool intent+schema, context-conditioned → R3 (converges with memory's pgvector).
- **babyagi** (`Function/FunctionVersion`, `activate` = rollback) → tool versioning; **claude-engineer** (self-authored tools as proposals) → contents acquire.
- **Misevolution / eval-gaming literature** → why promotions are **human-gated, never auto**, with an independent verifier.

> **Citation honesty:** the above foundational works are real and load-bearing. A cluster of very-recent (late-2025/2026) preprints surfaced during research (EvoSkills, CASCADE, ASG-SI, Tool-Genesis, ToolFlood, MalTool, "When Skills Lie") describe corroborating patterns but are **unverified leads** — verify each before citing as authority. The design conclusions stand on the corpus + the verified foundational work regardless.

> **Reminder:** this is *design*. "Solved memory / tools" = solved **on paper**; neither faculty is built.

# Agentic Platform — North-Star Concept (pressure-tested)

> **Status:** concept, stress-tested in a brainstorming/pressure-test session (2026-06-01). Not an implementation plan yet.
> **Working title:** zuzuagents. **Home repo:** this repo (`~/Documents/zuzuagents`).
> **Next step:** decompose into the first buildable vertical slice, then `superpowers:writing-plans`.

## Context

Three personal projects, each strong exactly where the others are silent, are being merged into one platform for building and managing multi-agent systems — *each agent is a node*:

| Project | Path | Contributes | Maturity |
|---|---|---|---|
| **Notes** (knowledge vault) | `~/Documents/notes` | The **memory model**: typed attribute/relation registry + flat data points + graph queries + self-evolving schema. Port the *model*, not the markdown. | Mature concept |
| **Zuzucodes Labs** | `~/Documents/zuzucodes/labs` | The **tool layer**: tool registry, input/output schema validation, OpenAI/Anthropic/MCP tool-def converters, **sandboxed code execution** (CF Containers + Durable Objects), secrets, credits, Composio. | Production-ready core |
| **Flow Engine** | `~/Documents/flow` | The **core engine**: save-time compiler, executor (LLM + tool loop), 4-tier budget cascade, durable execution via **Cloudflare Workflows**, analytics, node/graph data model, **a rich but dormant A2A spec**. | Solid core; A2A/multi-provider/eval not built |

The session goal was to **pressure-test whether the merger holds** (anchored on the core engine), not to spec it. It held — and got sharper. This doc captures the validated concept, the decisions, and the cuts.

---

## The spine (one paragraph)

> First-class **Agent / Memory / Tool** entities, **M:N-composed** (an agent *composes* faculties; it does not own them). Each faculty is a **tiered ladder behind a single stable interface** — promotion up a tier = swap the backend, agent code unchanged. A **generation** is an immutable pin of *definitions* (`system_prompt + model + tool_versions + memory_schema_version + attached_entity_refs`); *runtime data* (memory contents, tool side-effects, delegation choices) is **observed via traces** and scored by an `evaluate()` interface with a **swappable scorer** (code assertion → LLM judge → human). Execution is **Cloudflare-Workflows-shaped** (durable, `waitForEvent` human/A2A gates; live-streaming is a deferred side-channel). The invocation contract is **recursive** — agent-calls-agent is the engine calling itself — carries **caller-identity + a shared decrementing budget envelope** from day one, and produces **tree-shaped traces**.

**The backbone finding:** *Pin definitions, observe data.* Everything immutable/versioned is a definition (prompt, model, tool version, memory schema). Everything else is runtime, captured in traces and asserted by evals. This dissolved the entire "snapshot/replay memory" problem.

---

## The four faculty ladders

Each ladder: **one interface, backend swaps per tier, the bottom rung must be a complete shippable agent on its own.**

### 1. Memory — interface: `remember()` / `recall(query)` / `relate(a,b)`
```
L0  markdown file            (notes-style; genuinely safe + simple)
L1  relational (Postgres)     (entities as rows)
L2  + Apache AGE              (typed relations, graph traversal, Cypher)
L3  + pgvector                (semantic recall on top of graph)
```
- AGE/pgvector are **opt-in top rungs**, not a foundational commitment — this is what killed the "unified graph" risk. **AGE is a "prove-it" item:** benchmark against relational + recursive CTEs + pgvector before betting the hot path on its Cypher performance.
- **No platform-wide unified graph.** Topology stays its own concern; the graph lives *inside* the memory faculty's top tier, per agent.
- **Memory eval is operation-level, not state-reproduction:** assert over the *memory operations* recorded in the trace — right query/params? read/write succeeded? entity-resolution hit or miss? Misses are a free automatic eval. No memory matching, no snapshots, no temporal querying.
- **Two components from the original pitch live here:** (a) **entity-resolution** = a built-in process / specialised sub-agent *inside* the memory faculty (dedup + linking on write; its hit/miss is what eval checks); (b) **Cypher-like and relational/SQL-like queries** = the memory interface's backends (L2 AGE / L1 relational), surfaced to agents as callable memory tools.

### 2. Tools — interface: `describe() → definition` / `invoke(mode, args) → result`
```
L0  built-in function
L1  schema'd external call    (HTTP / Composio)        ← Labs tool-definition.ts
L2  sandboxed custom code     (user Python, CF Container) ← Labs runtime, ADOPTED WHOLESALE
L3  versioned / pinned tool    (resolve by id + version)
+   agent-as-tool             (another agent, same interface)
```
- **Decision: cross the L2 security cliff in v1** — adopt Labs' sandbox wholesale (it already solved isolation: Containers + DO + per-run HMAC + server-pinned identity). The platform is a code-execution platform from day one.
- **Net-new on top of Labs** (required by eval replay): an execution **`mode`** (live / replay / dry-run) and a **read-vs-write effect classification** per tool.
- **Versioning is required by the backbone:** generations pin tool *versions* → tools must be **immutable-by-version** (linear, no branching in v1).

### 3. Eval / Evolution — interface: `evaluate(target, criteria) → verdict`
```
scorer backend swaps:
L1  code assertion        (closed tasks: right tool? valid output? goal reached?)
L2  LLM-as-judge          (open tasks: rate trajectory vs. rubric)
L3  human judge           ← "human-assisted eval" = a human in the same interface (queue + UI)
L4  auto-harden loop      ← DEFERRED (DSPy-grade; reward-hacking/overfit risk)
```
- **Real L0 is a durable trace store of full trajectories** (Flow's Analytics Engine is *aggregate metrics*, not replayable traces — net-new). An eval set = curated production traces.
- **The loop:** observe → score across runs → suggest hardening → **human approves** → promote to **new generation**. Auto-implement is deferred.
- **"Hardening" is two things** — task-quality (v1) vs. adversarial/jailbreak robustness (later, separate eval set + judges). Don't conflate.
- Eval scopes become **per-agent and per-system** once multi-agent (tree-shaped traces).

### 4. Multi-agent — interface: recursive `start(agent, input, mode) → handle`
```
L0  single agent
L1  hierarchical delegation   (supervisor → workers)   ✅ v1
L1  pipeline / sequential     (A→B→C = Flow orchestrator) ✅ v1
L3  debate / consensus / blackboard  ← DEFERRED (needs shared-workspace + controller)
```
- **A2A = the execution contract applied recursively.** Agent-to-agent connection = one agent holding a handle to another's run. Maximal reuse.
- **M:N solves resource *sharing*, not *coordination*.** A shared workspace (blackboard) is just one Memory entity attached to N agents — falls out of the data model for free. But turn-taking / termination is still orchestration logic (a controller, itself an agent) — deferred.
- Flow's **dormant A2A spec** (streaming, push-notifications, async TaskState, security schemes) is the asset for the richer rungs; do not collapse it into plain tool-calling.

---

## Data model: first-class entities, M:N

- Three independently-versioned entities: **`Agent`**, **`Memory`**, **`Tool`** — joined **many-to-many**. An agent *composes* attached faculties.
- A **generation** pins **references to specific versions** of attached entities — a *lockfile* model. Promoting a shared entity (e.g. memory schema v3→v4) is a versioned event each attached agent **opts into** by re-pinning.
- Shared mutable memory needs **intra-resource scoping** (shared vs. agent-private facts) — scoped by the **caller identity** carried in the contract. (Identity isn't just authz/billing; it's what makes sharing safe.)
- **Decision (v1): model now, share later.** Build the M:N schema + versioned entities + identity field from day one; v1 runs single-owner with sharing *designed-in but not exercised* — avoids the concurrency/intra-scope/entity-resolution-race cost while preventing a retrofit.

---

## Substrate & runtime decisions

- **Engine spine = Cloudflare Workflows only** (one substrate). `step.waitForEvent()` provides durable pause for **human-in-loop gates** and **A2A callbacks**; instances are addressable and receive events. *Correction made in session: Workflows can do durable pause/resume + addressability — the Durable-Object "actor" is demoted from "the engine" to an optional side-channel.*
- **Deferred:** live token-streaming UI (add a thin DO/WebSocket or polling side-channel when a tier needs it); the always-on multi-client shared agent (actor-shaped — revisit later).
- **Tool code** runs in **Labs' sandbox** (Containers + DO) — a separate runtime the engine coordinates with per tool call.
- **Memory service** is **off-edge Postgres/Neon** (AGE/pgvector aren't CF primitives). The engine is therefore **coordination-heavy, not compute-heavy** — its real job is orchestrating LLM-provider + sandbox + memory across network hops with failure handling. The loop is the easy part.
- **Carry-forwards baked into the invocation contract from day 1:** caller **identity** field, and a **shared decrementing budget envelope** across the invocation tree (doubles as cycle/runaway termination — a cycle dies when the envelope hits zero).

---

## Reusability inventory (what to lift)

- **Flow:** the Workflows orchestrator, the executor's LLM+tool loop, the budget cascade, the save-time compiler, the node/graph data model, and the **dormant A2A spec** (`docs/spec.md §9`). Strip the separate `flows` table (a flow IS a node).
- **Labs:** `lib/tool-definition.ts` (converters), `lib/script-args.ts` (schema validation), and the **sandbox runtime contract** (Containers + DO + HMAC + Composio broker). *Not* liftable: Supabase-auth coupling, Labs' own credits, Next.js playground UI/routes — expect real extraction work, not glue.
- **Notes:** the *model* — registry of typed attribute/relation definitions + flat data points + graph queries + (later, deferred) self-evolving schema. Re-expressed as Postgres/AGE/pgvector, not markdown.

---

## v1 scope & YAGNI cuts (explicit)

**In v1:** bottom-row-complete agent; memory L0→(L1); tools through L2 (Labs sandbox); eval L1 + trace store + generation registry (manual promote/rollback); multi-agent L1 (hierarchical + pipeline); M:N schema + identity + shared-budget modeled.

**Cut (named):**
- Auto-harden / prompt-optimization loop (eval L4)
- Adversarial/security hardening (separate later ladder)
- Tool-version *branching* (linear immutable only); public tool marketplace
- Semantic tool retrieval (hand-assign small tool sets; it quietly wants memory's vector tier later)
- Temporal/as-of memory querying and physical memory snapshots (fixtures + traces suffice; if true historical re-execution is ever needed, prefer **Neon COW branching** over building temporal)
- Multi-provider routing (Workers AI to start)
- Notes' self-evolving schema (delightful, unnecessary)
- Live token streaming; always-on multi-client agents; debate/consensus/blackboard

---

## Decision log (this session)

| Decision | Choice |
|---|---|
| Session altitude | Pressure-test the concept |
| Anchor subsystem | Core engine |
| Unified graph | Dropped at platform level; AGE/pgvector = opt-in top memory rungs |
| Tier contract | One interface, swap backend |
| Memory pin / eval | Operation-level eval via traces; pin definitions not data |
| Tools L2 cliff | Adopt Labs sandbox wholesale (code-exec from day 1) |
| Backbone | Generation = immutable pinned tuple of definitions; pinning first-class |
| Engine substrate | Cloudflare Workflows only (+ deferred streaming side-channel) |
| Multi-agent v1 | Hierarchical + pipeline; debate/blackboard deferred |
| Contract carry-forwards | Bake in identity + shared budget envelope from day 1 |
| Data model | First-class Agent/Memory/Tool, M:N; model now / share later |

---

## Open questions (carried forward, not blocking)

- AGE vs. relational+CTE+pgvector benchmark (the "prove-it" for memory's top tier).
- **Workflows prove-it (the engine's parallel risk):** can a single CF Workflows instance comfortably host a multi-round agent loop (N LLM rounds × tool calls) with `waitForEvent` gates *inside* platform execution/duration limits — or does a tool-heavy agent blow the step / wall-clock budget? `waitForEvent` solves *pause*, not *loop-length-under-limits* — a distinct risk to validate.
- Exact shape of the trace schema (it is the substrate for observability *and* eval — design once).
- How tool `mode` (live/replay/dry-run) threads through Labs' existing runtime contract.
- The first vertical slice's precise boundary (what "bottom-row-complete agent" includes end-to-end).

## Verification (for the eventual build, not this doc)

This is a concept doc — "verification" = the next session decomposes the first vertical slice and runs it end-to-end (create an agent → it recalls from L0/L1 memory → calls one sandboxed tool → produces a trace → score the trace → register a generation). That slice becomes the first `writing-plans` target.

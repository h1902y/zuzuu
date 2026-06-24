# zuzuu — the design

> **⚠️ Read this first (2026-06-21): role changed.** The v2 rebuild shipped (rungs 1–8 — see [`LOG.md`](LOG.md)) and the v1 substrate this document's **architecture** sections describe (§3 *be/run/evolve* mechanics, §5 the module spine, §6 deployment, and the OTLP/trace/`distill`/`capture` vocabulary throughout) is **deleted**. The canonical, current account of *how the code actually works* now lives in [**`../CLAUDE.md`**](../CLAUDE.md) (architecture) and [**`learn/`**](learn/) (the educative walk, lessons 02–08). This file is preserved as the **strategy & rationale** record — the *why*: the core hypothesis (§2), the be/run/evolve framing and the entity model (§3–4), interactive-first (§7), lineage and prior art (§9, §11), and the fixed decisions. Read those for the reasoning; read CLAUDE.md/learn for the implementation. Where a mechanism here conflicts with the shipped code, the code wins.
>
> **What this was:** the canonical design document — what we're building, why, the architecture, the decisions, and the research it stands on. Depth lives in [`inspiration/`](inspiration/) (the source-level audits and the 100-project field survey). For *what runs today*, see the [repo README](../README.md).
>
> **Provenance:** until 2026-06-10 this file *was* the repo `README.md` — older experiment records, commit messages, and code comments that cite "README §N" mean **this document**. Converged 2026-06-01 → 2026-06-08; build began 2026-06-09.
>
> **Naming:** the project is **zuzuu** (current name; a return to the original concept) — was **motorsandsensors / mns** in the v0 phase (and **zuzuagents** / *zuzu* before that). The CLI is `zuzuu`. Sibling projects keep their own names (Zuzucodes Labs, Flow Engine, Notes). Where this doc says "we", it means zuzuu.
>
> **Terminology:** the five us-owned faculties were renamed **faculty → module** — code, CLI, the session digest, and the managed instruction block now all say **module**, so this doc has been migrated to match. "Faculty" survives here only where the text quotes the old wording verbatim (the 2026-06-10 anatomy-revision notes in §3). Older experiment records, commit messages, and code comments that say "faculty/faculties" predate the rename; treat them as the same concept.
>
> **Status — read this honestly:** the design ran ahead of the build by intent; the build has now caught up to the spine. *Built + verified* (exp-1–13, 309 hermetic tests): the observe layer (trace capture across **5** real hosts, the `zuzuu` CLI, live capture); serve (module home, a session digest to all 5 hosts, the enforced gate on all 5, five modules on one **shared spine** — proposal/provenance/trail/gate); and the **evolve loop in code** — trace miners (per module) → a mechanical **eval lens** → human-gated `zuzuu review` → versioned **generations** (immutable lockfiles, `mint`/`rollback`/drift-check) → Runs that pin a generation. What remains **solved-on-paper / unproven:** the loop graduating an agent from a *real* multi-session corpus (only golden-tested so far); the LLM-judge eval rung (mechanical-only today; `getScorer` seam exists); the Memory episode distiller (schema + stub miner only); and the Cloudflare-Workflows async runtime.

---

## 1. What we're building (the one-paragraph version)

Your host coding-agent — **Claude Code / Codex / Gemini CLI** — gives an agent a **brain** (the reasoning loop + the model). **zuzuu gives that agent an evolving Memory, body of Knowledge, set of Actions (skills), and Guardrails — improved automatically from how you actually work.**

The differentiator versus static wrappers (OpenClaw, Hermes, entire.io): **our modules *graduate*.** They level up across versioned **generations**, and you configure the graduation mechanism from observability insights. We don't run a competing agent loop and we don't sell inference — we **wrap, serve, observe, and evolve** the host you already pay for.

### The loop (the whole product in six steps)
1. **Wrap** the live *interactive* host session (never headless — see §7).
2. **Serve** modules (via MCP / instruction-files / filesystem) **and observe** the session as a normalized **trace**.
3. **Evaluate** — score module operations from the trace.
4. **Propose** — a trace-miner suggests a graduation (memory promotion, tool crystallization, guardrail tightening, substrate tier-up).
5. **Approve** — a human disposes, async and out-of-band, in an inbox.
6. **Pin** — the approved change becomes a new **generation** (rollback = flip a pointer).

> **Backbone principle: _pin definitions, observe data._** Everything immutable/versioned is a *definition* (prompt, model, tool version, memory schema). Everything else is *runtime*, captured in traces and asserted by evals. This single rule dissolved the entire "snapshot/replay the run state" problem.

---

## 2. The core hypothesis — generational graduation

An agent's components (memory, knowledge, tools, prompt, guardrails) **improve over versioned generations**, and a **human sits in an async, out-of-band loop** to evaluate and promote them. The missing piece the field doesn't have: not just *configuring* modules, but **growing** them from the trace of real use.

### The efficiency corollary (the business thesis, 2026-06-10)

The graduation hypothesis has a commercial sharp edge: **a workspace that has graduated — good/bad practices and instructions baked in, the optimal tool set, project-specific knowledge and memory — makes an agent extremely efficient *even on a not-so-powerful model*.** Hyper-personalization substitutes for raw model power. That's the pitch in one line: *zuzuu-style working = better agent-AI-first project management*, because the workspace itself is specialized for the project. Falsifiable, and worth proving: **a benchmark suite** showing a zuzuu-equipped weak model beating bare stronger/open setups on project-local tasks (tracked as a roadmap issue; the testing suite grows a benchmarks layer for it).

### The two axes (the crux — never fuse them)
Every module evolves on **two independent axes**:

| Axis | What evolves | How it changes |
|---|---|---|
| **Substrate** | *how* a module is implemented | **set** by an operator — a tier choice behind a stable interface |
| **Contents / capability** | *what* a module has accumulated + its promotion to richer forms | **earned** from trace data via a governed pipeline |

The true symmetry — and the core hypothesis — lives on the **contents axis**: Knowledge's episodic→semantic promotion and Actions' *crystallization* are **the same governed pipeline**. One trace feeds both; one human gate; one unit of versioning (the generation). Both substrate ladders expand *power over accumulated stuff* and **converge on the vector tier** (semantic recall / semantic tool-selection — same pgvector substrate). A substrate jump only counts as evolution if it *changes what the agent can do* — which is why code-organization (script→OOP→package) is **hygiene, not a rung**.

### The unified promotion engine
```
observe (trace spans)  →  eval (score the module's operations)  →
  trace-miner detects a promotion signal  →  files a Proposal  →
    human approves (async, out-of-band, in an inbox)  →  pin as new generation
```
- **Proposal** is a first-class entity: `{ module, kind, trigger_signal, evidence (trace refs + eval scores), suggested_diff, status: pending|approved|rejected }`. It is the bridge from observability to generation.
- **Async + human-gated, never auto in v1.** Auto-crystallization from traces is the same research-grade problem (reward-hacking / overfit) we deliberately cut. The async human loop *is* the safety boundary.

---

## 3. Architecture — *be / run / evolve*

The organizing principle: for any primitive, ask whether it is part of what the agent **is** (a module), what **runs & bounds** it (the runtime), or what **grows** it (the evolution engine).

> **One-line story:** an **agent** is a durable entity composed of **evolving modules**, running on a **runtime**, grown by an **evolution engine** that *observes* the modules running, *evaluates* what it sees, and *graduates* them into new generations — human-gated. The system **learns from the observability traces of previous runs**: that loop is the whole product.

### ① The Agent — what it *is* (the 5 + 3 anatomy)

> **Revised 2026-06-10** (was "7 faculties, 4 us / 3 host"). Two fixes: **Instructions** promoted to a module (the pinned `system_prompt`/steering artifact always behaved like one — us-owned, evolving, pinned — but had no name), and the host trio stopped being called "faculties" (a process, an engine, and an arena aren't faculties of the agent). Operational definition of a module: **us-owned · contents accumulate from traces · graduate via proposals · pinned in generations · served to the host.** *(These five were called "faculties" until the later faculty→module rename — see the Terminology note up top.)* **No prebuilt modules (2026-06-23):** the five are the standard module *types*, but `zz init` ships only the **Guardrails** safety floor — the four content modules start empty and materialize on demand (their manifest minted on first proposal) as the loop grows the zuzuu. Shipping-prebuilt went away; the types and their operational definition stand.

**The standard modules (ours):**

> *A module is **generic** — any goal-shaped collection of notes, declared by its `module.md`. The five below are the **standard us-owned kinds** (sensible defaults, a considered cognitive anatomy), **not a closed taxonomy**: modules are an open set, and custom ones materialize on demand. Read the table as the common kinds + the rationale for each, not a limit on what a module can be.*

| Module | Cognitive analog | Role | Evolves by |
|---|---|---|---|
| **Knowledge** *(semantic)* | semantic memory | what's *true* — domain facts, entities | extraction + entity-resolution + reflection; substrate ladder `md → relational → graph → vector` |
| **Memory** *(episodic)* | episodic memory | what *happened* to me — past runs/conversations | distilling the trace into curated recollection; reflection |
| **Actions** *(procedural)* | procedural memory | how to *do* things — skills/toolkits (unit = a "tool") | the selection-burden ladder + a contents lifecycle |
| **Instructions** *(directive)* | self-schema / values | who I *am*, how I should behave — the pinned `system_prompt` + project steering | steering text mined/refined from trace insights; pinned per generation |
| **Guardrails** *(protective)* | inhibitory control | what I must *not* do — enforced gates on tool I/O, not advice | inspector rules in an ordered gate pipeline; pinned in the generation |

**Host anatomy (not modules — what ours plug into):** **Cognition** (the reason→act→observe *process*; steerable only via Instructions injection), **Model** (the *engine*; the host's subscription/choice), **Workspace** (the *arena*; the real machine/repo).

**The deep structure:** the five map cleanly onto cognitive systems — semantic, episodic, and procedural memory plus the self-schema (Instructions) and executive inhibition (Guardrails). Cognition reasons over all of them; Model is the substrate; Workspace the arena.

> **Vocabulary note:** earlier docs called the *semantic* module "Memory", and pre-2026-06-10 docs say "4 faculties" with Instructions folded into serving mechanics. Canonical now: **Knowledge** = semantic, **Memory** = episodic, **five** us-owned modules, host trio = anatomy. (And the five were "faculties" until the faculty→module rename — Terminology note up top.)

### ② The Runtime — serve, observe, evolve (it does **not** run the agent loop)

Because the **host** owns the agent loop and inference, our runtime is *not* "run the agent." It **serves modules to a host we don't run, captures the boundary trace, and durably runs the async evolution loop.**

| Primitive | Role (reframed for the wrap-the-host model) |
|---|---|
| **Activation** | *when we act* — scheduled **graduation reviews** + on-demand module calls. The user drives the agent loop from their terminal; our heartbeat is the evolution review. |
| **Durable execution** | runs **only the async evolution loop** (eval → propose → graduate) on Cloudflare Workflows + `waitForEvent` — **not** the hot agent loop. *This dissolves the CF-Workflows loop-length risk.* |
| **Budget** | tracks **our** module-execution cost (sandbox/embeddings) + **observes** host token spend (we don't enforce the host's inference). |
| **Identity & permissions** | user identity, per-user module scoping, secrets for *our* Action execution (proxy-side injection so the sandbox never holds a raw secret). |
| **Inference** | the **host's** for the agent loop (free to us); our *internal* LLM ops (extraction, eval-judge, proposals) run on **our own cheap model** — until **MCP Sampling** lets us run them on the user's model (north-star; not host-supported today). |

### ③ The Evolution engine — what *grows* it

```
Observability/traces  →  Evaluation  →  Generations  →  Governance (human async loop)
   (capture the run)      (judge it)     (pin/rollback)   (approve the promotion)
```
- **Observability** — the typed, append-only, tree-shaped trace of every run. The keystone artifact; also the raw episodic stream that feeds the Memory module. **Build it first.**
- **Evaluation** — scores the trace; swappable scorer (code assertion → LLM-judge → human). Distinct from observability: capture vs judge.
- **Generations** — the spine: an immutable pin of module definitions + an active pointer + `forkedFrom`; rollback = flip the pointer.
- **Governance** — the human, async and out-of-band: approves a proposal → it becomes a new generation. The trace-miner proposes; the human disposes.

---

## 4. The entity model — Agent / Generation / Run

Three levels, distinct lifetimes:

- **Agent (durable):** identity, role/title, reporting position, **active-generation pointer**, generation lineage, attached module refs (Memory/Knowledge/Actions, M:N), budget policy. It is an **employee, not a script** — it never "finishes."
- **Generation (immutable pin — the lockfile):** `{ system_prompt (+hash), model, tool refs+versions, memory/knowledge refs+schema-versions, input_guardrails, output_guardrails, budget envelope }`. Immutable version rows + `isActive` pointer + `forkedFrom`; **rollback = flip the pointer.**
- **Run / Episode (transient):** one invocation under a generation = a bounded goal-loop. Composable termination: `goal-reached` (typed end-turn tool) **OR** `budget-envelope-zero` **OR** `max-rounds/stall` **OR** `waiting-for-human`. Emits a **trace** (tree of typed spans). Runs are the substrate for evals + promotion mining — *not* a generation.

First-class entities **`Agent` / `Memory` / `Knowledge` / `Actions`**, joined **many-to-many** — an agent *composes* modules, it does not own them. A generation pins **references to specific versions**; promoting a shared module is a versioned event each attached agent **opts into** by re-pinning. **Decision: model M:N + identity from day 1, run single-owner in v1** (sharing designed-in, not exercised) — avoids a retrofit without paying the concurrency cost early.

---

## 5. The modules in depth

### Knowledge (semantic) — interface `remember` / `recall` / `relate`
- **Substrate ladder (earned):** `L0 markdown → L1 relational (Postgres) → L2 graph (Apache AGE, Cypher) → L3 pgvector (semantic recall)`. AGE/pgvector are **opt-in top rungs**, not a foundational commitment (this killed the "platform-wide unified graph" risk — the graph lives *inside* the module's top tier, per agent). **AGE is a "prove-it"** — benchmark vs relational + recursive CTEs + pgvector before betting the hot path on Cypher.
- **Contents lifecycle:** `working-state → mined candidate fact → proposal → approved fact/relation → schema/tier promotion → archive/forget`. Entity-resolution (dedup + linking on write) is a built-in sub-process; reflection promotes episodes→semantics.
- **Eval is operation-level, not state-reproduction:** assert over the memory *operations* in the trace (right query? read hit/miss? write ok? entity-resolution hit/miss?). No snapshots, no temporal querying.

### Actions (procedural / tools) — interface `describe` / `invoke(mode, args)`
- **Contents axis** (*what tools exist*): `ephemeral action → mined candidate → proposal → approved named tool (v1) → generalize → upgrade (v2…) → retire`. Versioned immutably; a generation pins specific tool versions, so a tool upgrade is a generation event the agent opts into. Self-authored tools are *proposals*, not live mutations.
- **Substrate axis** — a **selection-burden ladder** (the work of selecting & composing tools shifts off the agent onto structure as the set grows):
  ```
  R0  Single tool                  — no selection problem.
  R1  Many · AGENT-DECIDED         — flat catalog; LLM picks by name.            [Labs today]
  R2  Many · SCHEMA-ASSISTED       — typed I/O → a compatibility graph makes chains
                                     mechanical & typecheckable; tags/groups scope.
  R3  Many · SEMANTICALLY-RETRIEVED— catalog outgrows the prompt; embed intent+schema,
                                     retrieve top-k. (vector → sibling to Knowledge's pgvector)
  R4  Composed · CRYSTALLIZED      — a proven recurring chain → ONE named composite tool,
                                     versioned. (contents ⋂ substrate meet here)
  R5  Tools-as-SERVICES            — mature composite extracted to a shared, scaled service.
  ```
- **The agent always decides** — structure only *narrows & validates* its choice-space. **R2 is nearly free** on the existing Labs tool model (it just *uses* the stored `inputs_schema`/`outputs_schema` to build a typed compatibility graph) — the immediate next step.
- **Composition = a declarative typed DAG** (decided), not generated code: `{ nodes: tool-refs (pinned versions), edges: typed output→input wirings }` + its own outer schema. Typecheckable (an edge is legal iff types satisfy), inspectable, diff-able, versioned as a generation. *This reuses Flow Engine's node/graph data model* — a composite tool is a mini-flow, converging with the agent org-chart canvas (same graph primitive, different scale).

### Memory (episodic)
The agent's *curated* recollection distilled from the raw observability stream: seed (system prompt) → conversation scaffolding → historic-conversation analysis → steering. Likely a different substrate from Knowledge (append-heavy run/conversation log + summarization, vs relational/graph/vector facts) — confirm during build.

### Instructions (directive) — who the agent is
The pinned steering artifact: the generation's `system_prompt` (+hash) at platform level; per-project, `.zuzuu/instructions/` served via instruction-file injection. Evolves like every module — steering text refined from trace insights ("the agent keeps doing X wrong" → a proposal to amend the instructions → human approves → new generation). Distinct from host-owned Cognition (the loop itself): Instructions is *our artifact that shapes* the loop. *(Promoted to a module 2026-06-10 — it always met the operational definition.)*

### Guardrails (protective) — the enforced membrane, pinned in the generation
Input (prompt-injection scan, PII scrub, schema validation) + output (schema validation, moderation, redaction-before-persist, policy) implemented as **inspectors in one ordered gate pipeline**; each returns `Allow / Deny / RequireApproval`; `RequireApproval` → `waitForEvent` pause → approval inbox. Each check is a **GUARDRAIL span** on the trace, so the safety trail *is* the execution trace.

> **Built (v1, 2026-06-10):** the first enforced gate — declarative rules (`.zuzuu/guardrails/rules.json`: `{id, action: deny|ask|allow, tool, pattern, reason}`) evaluated per tool call; severity wins (deny > ask > allow); **fail-open** (engine errors/missing rules block nothing — a guardrail bug must never brick the agent); matched decisions logged per session (the GUARDRAIL-span precursor). `ask` maps to the host's permission prompt — the v1 form of `RequireApproval`. **Enforced on all five hosts** (exp-11 + exp-12, all real-wire-verified): Claude Code (`PreToolUse`), Gemini CLI (`BeforeTool` → `{decision:"deny"}`), Codex (`PreToolUse` → Claude's `hookSpecificOutput` schema; **interactive-only** — `codex exec` fires no hooks), OpenCode (plugin throws from `tool.execute.before`), and pi (extension returns `{block:true}` from `tool_call`). The host-agnostic engine evaluates identically; only the per-host block-response format differs. The full inspector pipeline (PII/injection/moderation) remains design.

**Tools are a first-class attack surface** (self-evolving/imported tools make this acute): treat all self-authored + MCP tools as **untrusted → sandbox by default**, require provenance, block secret/env enumeration, redact secrets before they hit the trace; **code-review-on-promotion** for crystallized/authored tools (staged validation: interface→signature→contract→golden-replay, *plus* a human review); **retrieval-poisoning defense at R3** (multi-signal ranking, not embedding-similarity alone); evals run on *unseen* traces with an **independent verifier** (proposer ≠ scorer).

---

## 6. The deployment model — we wrap a host you already run

zuzuu is **terminal-first** in *experience* and **MCP-core** in *mechanism*, in three rings:

1. **MCP core (host-agnostic backbone)** — modules served over MCP: **Tools→Actions · Resources→Knowledge/Memory recall · Prompts→scaffolding · Roots→Workspace scoping · Elicitation→HITL/approval** (works on Claude Code today) **· Sampling→run our internal LLM ops on the user's model** (north-star; *not host-supported yet*). Every MCP call is a trace span.
2. **Per-host shim (progressive enhancement)** — instruction-file injection (CLAUDE.md / AGENTS.md / GEMINI.md, `--append-system-prompt`) everywhere; **native lifecycle + pre-tool hooks on all five hosts** (Claude `SessionStart/Stop/SessionEnd/PreToolUse`; Gemini `SessionStart/AfterAgent/SessionEnd/BeforeTool`; Codex `SessionStart/Stop/PreToolUse`, interactive-only; OpenCode bus plugin + `tool.execute.before`; pi extension `session_start/turn_end/session_shutdown/tool_call`) → live capture + tool-gating, each wired from real captured payloads (exp-11 + exp-12). Capture *depth* still varies (Gemini's log is prompt-only; Claude/Codex/pi carry tool spans) — that's a per-host transcript-richness gap, not a hook-surface gap.
3. **Server control-plane** — stores configs + learnings + generations, runs the async evolution loop + CI/CD-style trace analysis. Plus a **local-native mode**: the whole harness = instruction files + a local MCP server — non-intrusive, secret-free, optional server sync.

### Three module-serving surfaces (pick per module/host)
- **MCP** — structured, fully observable (every call = a span). Default for Actions; needs host MCP support.
- **Instruction-file injection** — CLAUDE.md/AGENTS.md/GEMINI.md, with **delimiter-block + auto-cleanup** coexistence discipline. Universal; for scaffolding/hints.
- **Filesystem (mount / virtual-bash)** — serve Knowledge/Memory as files (the smfs model). **Most host-agnostic** (uses the agent's own `Read/Write/Grep/Bash`, zero MCP); "flagless grep = semantic / flagged = literal". *Tradeoff:* a raw `cat` isn't a clean span → use a **virtual-bash single-tool** (`run_bash` + shipped tool-description) when observability matters.

> **Honest trace tradeoff:** MCP-only sees calls *to us*, not the host's built-in tool calls. **Observability completeness ∝ how much the host routes through us.** Mitigate by pulling work through MCP + an instruction-shim + progressive hooks. Trace propagation: **W3C TraceContext via MCP `params._meta`** (host-agnostic, local-first).

### The host-adapter is an *observe* model (not a streaming bridge)
Because we **wrap & observe** a loop we don't drive, the HostAdapter follows entire.io's proven shape, **not** goose/hermes's `run()`/`stream()` (that is for *driving* a host — out of scope): a required **`Agent`** interface (detect presence, read/write session, resolve transcript, resume) + optional **`HookSupport`** (`installHooks` writes the host's *native* hook config → callbacks into one binary → `parseHookEvent(stdin) → Event`) + optional **capability interfaces** (`TranscriptAnalyzer`/`TokenCalculator`/`FileWatcher`-fallback) + a **registry** (`detect()` by presence). Every adapter normalizes its native hook into **one `Event`**; the dispatcher routes by `EventType`, **never by agent name** — so the eval lens stays agent-agnostic. **This `Event` is the basis of our trace-span schema** ("design the trace once"). Always graceful-degradation (never break the host if our binary is absent); `permissions.deny` on our own metadata dir (no feedback loop).

### Model & provider agnosticity — two distinct needs
- **Need 1 — host-agnosticity:** the observe-adapter above; host owns model selection; assume no shared host model-schema.
- **Need 2 — internal-inference agnosticity** (our own module ops; a **stopgap until MCP Sampling**, so don't over-build): a thin litellm-*style* surface (one canonical `complete()`/`stream()` + `drop_params`, provider from a `provider/model` string — aider's altitude, **not** vendoring litellm, **not** continue's ~70 subclasses). Config = two blocks: `host:` (adapters; model host-owned) + `inference:` (`default` + per-module overrides + custom providers + type-keyed fallbacks). Reusable pattern: separate **`api`** (wire protocol) from **`provider`** (id) → a new OpenAI-compatible vendor = zero code.

### OpenCode as the default bundled host (adopted 2026-06-10 as stage 2 — see the three-stage sequence below)
The host adapters assume the user *already runs* a host. But a newcomer who runs none of Claude Code / Codex / Gemini needs an agent to wrap. **OpenCode (OSS, MIT) is the natural default to bundle** — and it makes us a richer integration, not just an observer:
- **zuzuu as an OpenCode plugin** (`@opencode-ai/plugin`) — **built + live-verified.** A project plugin (`.opencode/plugin/mns.js`, installed by `zuzuu enable --host opencode`) fires the zuzuu lifecycle hook on OpenCode's bus events. OpenCode's event surface is finer-grained than Claude's at the *tool/message* level (`tool.execute.before/after`, `message.part.updated`), but — verified by observing real runs — its **session lifecycle is the same shape as Claude's**: `session.created` = start, `session.idle` ≈ Claude's per-turn `Stop`, and **no clean end signal** (`session.deleted` is delete-only, not normal completion), so ended/killed sessions reconcile via staleness (`zuzuu doctor`), exactly like Claude. So "be a plugin for OpenCode" maps cleanly onto the Phase-2 lifecycle model — it's a peer live-capture host, not a categorically better one. *(Both the SQLite read-adapter and the live plugin are real-data-verified against a live `opencode run`.)*
- **Default-host ≠ abandoning host-agnosticity.** We still observe any host; we'd merely *ship one default* so non-host users get started in one step. The four-adapter set (Claude/Gemini/Codex/OpenCode, all real-data-verified) is the agnosticity proof.
- **Credits via zuzuu → OpenCode (monetization hypothesis — two models, decide later, neither built):**
  - **(a) zuzuu-as-gateway** — zuzuu hosts an OpenAI-compatible endpoint; OpenCode points at it as a custom provider; users buy zuzuu credits (Razorpay) and zuzuu proxies upstream + keeps margin. *Controllable, no partnership needed — but real infra/payments/abuse work.*
  - **(b) Zen-reseller** — credits top up OpenCode's own Zen balance. *Simpler conceptually, but depends on an OpenCode partnership; no public reseller API found.*
  - **(c) zuzuu-credits for internal LLM ops (added 2026-06-10)** — users *without* ollama and *without* host subscriptions (Claude Code/Gemini/Codex) buy zuzuu credits; zuzuu provides the API access for its **specialized internal work** — entity resolution's LLM rung, embeddings, eval-judge, instructions-mining — and external LLM use generally. Natural fit: these ops are exactly the ones DESIGN already routes to "our own cheap model" as the MCP-Sampling stopgap (§6 Need-2) — the credit wallet monetizes that stopgap instead of apologizing for it.
  > Credits remain flagged, not decided. The point today: the *plugin + default-host* path is real and partly built; the *credit* path is a business decision parked behind it. Two further monetization hypotheses (cloud sandboxes, zuzuu-codes broker) were added 2026-06-12 — see §13.

### The three-stage product sequence (decided 2026-06-10)

The efficiency corollary (§2) gets a delivery vehicle in three stages — each stage funds the evidence the next one needs. The pitch is constant throughout (*hyper-personalized workspace ⇒ same work on a cheaper model with fewer tokens*); only the depth of harness control grows:

1. **Stage 1 — host-agnostic wrapper (building now):** wrap the hosts users already run — Claude Code, Gemini CLI, Codex (+ OpenCode as a peer). Modules served via instruction-file injection + filesystem; live capture and the guardrails gate wherever the host's hook surface allows. The pitch here: *your existing subscription goes further* (§7 pricing edge preserved). Current state (exp-11 + exp-12): **post-hoc capture, live capture, and the enforced gate now span all five hosts** — Claude Code, Gemini CLI, Codex, OpenCode, and pi (Codex interactive-only — `codex exec` fires no hooks) — every one wired from real captured hook payloads and dogfooded end-to-end. The Stage-1 host-agnostic wrapper is complete; the gate is host-honest (deny hard-blocks everywhere; `ask` is native on Claude, defers elsewhere). Note pi is *also* the Stage-3 owned-harness target — here it's covered as a wrapped host; building the harness on pi stays benchmark-gated.
2. **Stage 2 — double down on OpenCode (stage-1 host parity reached; launcher shipped 2026-06-11):** **`zuzuu code` is built** — one command ensures the module home, detects + installs OpenCode on demand (zero-dep: a runtime peer, never an npm dependency), wires the zuzuu plugin (capture + gate + grounding), and launches the real `opencode` interactively (configure + launch, never fork or drive). The one-step door for users who run no host. *Still to come in stage 2:* the **efficiency benchmark** (§2) at scale — token-per-task with/without modules on cheap models — and optional zuzuu provider/credits onboarding. Not a fork — a distribution.
3. **Stage 3 — granular control via pi (after OpenCode stabilizes, gated on benchmark evidence):** if the benchmark shows the efficiency ceiling sits in *context assembly itself* (system prompt, tool descriptions, compaction, per-turn module retrieval), build the owned harness on **pi** (earendil-works' minimal coding agent: 4-tool core, extension/skill/SDK surface) — never an OpenCode fork, never from scratch. pi needs its own adapter (one file, real-wire-observed) when this stage opens.

> Stage 1 is build; stages 2–3 are committed *direction*, contents unbuilt. Each transition has an explicit gate: stage 1 → 2 = wrapper stability across the four hosts; stage 2 → 3 = benchmark evidence that plugin-level serving can't reach the claimed efficiency.

---

## 7. Why interactive-mode-first (a product pillar, not a detail)

We augment the developer's **live interactive** host session and **never drive the host headlessly.** Two Anthropic-structural reasons:

- **Pricing.** Verbatim from Anthropic's docs: *"Starting June 15, 2026, Agent SDK and `claude -p` usage on subscription plans will draw from a new monthly Agent SDK credit, separate from your interactive usage limits."* Headless wrappers (OpenClaw, Hermes via `claude -p`) sit in the **metered** pool (or are forced onto API keys via `--bare`); interactive use rides the **unchanged subscription** pool.
- **Surface.** Hooks / MCP / CLAUDE.md / skills **only fully work in interactive mode** (`--bare`/headless skips them). Interactive is the *only* mode where our wrapping surface exists — headless wrappers lose exactly what we use *and* get metered.

> *Watch-item:* Anthropic could later police interactive augmentation too. **No evidence today** — interactive use is explicitly permitted — but track it. (Detail + verified-vs-directional split: [`inspiration/claude-code-pricing-audit.md`](inspiration/claude-code-pricing-audit.md).)

---

## 8. The product surface — design system & agent canvas

The first *visual* build target: a design system + the canvas on which **agent nodes** are arranged into architectures.

- **Design system — lifted from Zuzucodes Labs as-is** for brand cohesion: OKLCH token palette (pale-rose/lemon/peach + 6-hue pastel chips), fonts (Poiret One / Quicksand / Arvo / Major Mono Display), `lib/motion.ts`, `components/ui/*` primitives. Stack: Next.js 16 / React 19 / Tailwind v4 / CVA / Radix / Framer Motion.
- **The agent node — a rounded-corner flat-top hexagon** (signature component): role glyph + name + status dot at rest; one context line on hover (`model · 🧠 <tier> · N 🔧`); side panel on select. Variants: leaf / supervisor / root / **mirror**. States: `idle · selected · running · paused-for-human · completed · failed · eval-flagged` (mapped to Labs semantic tokens; `paused-for-human` ties to the engine's `waitForEvent` gates).
- **The canvas — a Zapier-elegant, auto-arranged 1:N tree.** Single-rooted; dependents fan onto the next row; no free-drag scatter. Uniform solid 1:N delegation edges with run-pulse animation. **Mirror nodes** (ghosted, dashed, "↪ mirror" badge) handle sharing without a DAG — a mirror is an *alias of the same agent entity* (same memory/tools/generation), so the tree stays clean and every edge stays 1:N.
- **Side panel** (Labs `Sheet`): tabs Identity / Memory / Tools / Generation & Eval.
- **Tech substrate (confirm at review):** React Flow (xyflow) + an auto-layout pass (elkjs or dagre, `direction: DOWN`). The strict 1:N tree makes layout trivial and stable.

> Strict super→sub is **1:N** (every node has exactly one parent) → the canvas is a clean tree; M:N is for module *sharing*, not delegation topology.

---

## 9. Lineage — three personal projects merged

The platform merges three projects, each strong where the others are silent:

| Project | Contributes | What to lift |
|---|---|---|
| **Notes** (knowledge vault) | the **memory model** — typed attribute/relation registry + flat data points + graph queries | the *model*, re-expressed as Postgres/AGE/pgvector (not the markdown) |
| **Zuzucodes Labs** | the **tool layer** — registry, schema validation, OpenAI/Anthropic/MCP tool-def converters, **sandboxed code execution** (CF Containers + Durable Objects), secrets, Composio | `lib/tool-definition.ts`, `lib/script-args.ts`, the sandbox runtime contract. *Not* liftable: Supabase-auth coupling, Labs' credits, the Next.js playground |
| **Flow Engine** | the **core engine** — save-time compiler, executor (LLM+tool loop), 4-tier budget cascade, durable execution via **Cloudflare Workflows**, node/graph data model, a rich but **dormant A2A spec** | the Workflows orchestrator, executor loop, budget cascade, compiler, node/graph model, the A2A spec |

**Substrate decisions:** engine = **Cloudflare Workflows only** (one substrate; `waitForEvent` for human/A2A gates; the Durable-Object "actor" is demoted to an optional streaming side-channel). Tool code runs in **Labs' sandbox**. Knowledge/Memory = **off-edge Postgres/Neon** (AGE/pgvector aren't CF primitives) — so the engine is **coordination-heavy, not compute-heavy**. **A2A = the execution contract applied recursively** (agent-to-agent = one agent holding a handle to another's run); the invocation contract carries **caller-identity + a shared decrementing budget envelope** from day 1 (which doubles as the cycle/runaway kill — a cycle dies when the envelope hits zero).

---

## 10. v1 scope & explicit cuts

**In v1:** the Agent/Generation/Run entities; the **Proposal** entity + a human **promotion inbox**; the trace-miner with the cheap, unambiguous signals first (*retire unused tool*, *high tool-failure*, *entity-resolution miss*); operation-level eval lens for Actions + Knowledge; guardrails-in-generation via the inspector pipeline; tool + memory versioning feeding the generation pin; memory L0→(L1); tools through L2 (Labs sandbox); multi-agent L1 (hierarchical + pipeline); M:N schema + identity + shared-budget *modeled*.

**Cut (named):** auto-implement / auto-crystallize (always human-gated in v1) · agent-self-proposal (trace-miner only first) · adversarial/security hardening (separate later ladder) · tool-version *branching* (linear immutable only) · public tool marketplace · semantic tool retrieval (hand-assign small sets first) · temporal/as-of memory querying + physical snapshots (fixtures + traces suffice; prefer Neon COW branching if true historical re-execution is ever needed) · multi-provider routing (Workers AI to start) · Notes' self-evolving schema · live token streaming · always-on multi-client agents · debate/consensus/blackboard.

---

## 11. Grounding & prior art

The design is grounded in a structured audit of **100 open-source agent harnesses/frameworks** plus five source-level audits of the closest prior art. The full material lives in [`inspiration/`](inspiration/); the essentials:

### The field survey ([`inspiration/agent-harness-survey.md`](inspiration/agent-harness-survey.md))
An exhaustive, educative reference organized by the **primitive entities of an agent** (Part I — the agent: model, instructions, loop, planning, working-state, goals, tools, tool-infra, memory types & substrate; Part II — orchestration/runtime: topologies, delegation, durable execution, scheduling, persistence, gateway, extensibility; Part III — observability, evals, generations, budget, governance, guardrails, tickets, UI). For each: *what it is*, *the design space*, *how the field does it* (citing specific projects), and *the recommendation for us*.

**Where our decisions override the field's dominant patterns:** "snapshot/fork the run state for generations" → **pin definitions, observe data** (snapshots are eval substrate, not the generation model); "model the org as an arbitrary DAG" → **strict 1:N tree + mirror aliases**; "add cron/Temporal/Inngest as the runtime" → **CF Workflows only**; "flat per-call cost caps" → **shared decrementing budget envelope** up the recursive tree.

**Top borrows (by leverage):** ① a typed append-only tree-shaped **trace**, one schema (the keystone — build first) → ② versioned-definition-row + `isActive` + `forkedFrom` generations → ③ a middleware/hook stack as the universal extensibility seam → then `reportsTo` self-FK org model, delegation-as-a-tool, durable `waitForEvent` HITL, shared budget envelope, tool-trace-as-eval-assertion, a unified Score table, per-module memory extractor + gatekeeper, schema-from-signature + effect-class, MCP as the tool protocol, spec-vs-instance sandbox, secret redaction, approval inbox, run-pulse visualization, proposal-first self-improvement, and **tickets (net-new — flagged, not assumed)**. Two near-twins to read cover-to-cover: **paperclip** (structural template — org DB model, ticket/dependency split, wakeup queue, locks) and **lobe-chat** (feature reference — tiered governed memory, supervisor enum, generation-tracing, approval-gated nightly self-review).

### The five source-level audits ([`inspiration/`](inspiration/))
- **entire.io** ([`entire-io-host-adapter-audit.md`](inspiration/entire-io-host-adapter-audit.md)) — the closest prior art to our host-adapter layer. The blueprint for the **observe path**: `Agent` + optional `HookSupport`/capability interfaces + registry; one normalized `Event` (the basis of our trace schema); per-agent native hook-writer + one callback binary + graceful degradation; `RedactedBytes` redact-at-write; git-branch-as-storage for local-native mode. *entire stops at system-of-record (capture + link to commits); it does not evaluate or evolve — that graduation engine is our wedge.*
- **Claude Code pricing** ([`claude-code-pricing-audit.md`](inspiration/claude-code-pricing-audit.md)) — the verified basis for interactive-mode-first (§7). **Verified-vs-directional split is explicit**; don't quote the directional numbers externally without re-checking.
- **Model/provider agnosticity** ([`model-provider-agnosticity-audit.md`](inspiration/model-provider-agnosticity-audit.md)) — the two-needs split and config schema (§6). Grounded in goose/hermes/aider/continue/litellm. **Caveats:** Claude Code is closed-source (its adapter must be reverse-engineered from CLI flags / stream-json); MCP-Sampling migration is unprecedented in all audited repos; the OpenClaw repo's metadata is implausible (~377k stars) → **lean on goose/hermes; treat OpenClaw as corroborating-only**.
- **supermemory/smfs** ([`supermemory-smfs-audit.md`](inspiration/supermemory-smfs-audit.md)) — proves the **filesystem** serving surface; copy the serving interface + crash-safe SQLite push-queue + `dirty_since` versioning + delimiter-block instruction injection + tool-description-as-contract. **But its heavy lifting is cloud-dependent (Supermemory SaaS)** — we are local-first, so copy the interface/cache patterns, **not** the cloud extraction/index.
- **Terminal-first runtime** ([`terminal-first-runtime-research.md`](inspiration/terminal-first-runtime-research.md)) — verification research. **OpenClaw VERIFIED** ("a harness that manages everything except the LLM's reasoning" — our exact shape); **Hermes VERIFIED** (self-improving, extracts skills after 5+ tool calls — validates evolving Actions); **Pi/pi-dev UNVERIFIABLE**. **Honesty flags:** MCP **Sampling is NOT host-supported today** (Claude Code issue #1785); **Elicitation IS** (Claude Code); ACP proxy chains are the emerging standard but barely adopted (Zed only).

> **Citation honesty (carried from the research):** the foundational works behind the tool-evolution arc — Voyager, LATM, CRAFT, ToolLibGen, DSPy/LLMCompiler, Gorilla/ToolGen, babyagi, claude-engineer, and the misevolution/eval-gaming literature — are real and load-bearing. A cluster of very-recent (late-2025/2026) preprints surfaced during research are **unverified leads** — verify each before citing as authority.

---

## 12. Build order & open questions

**Build order (incremental; each slice independently useful):**
1. **Trace capture** (Claude-Code-first, local) — the keystone ← *the thing to build first*
2. Module serving (MCP / filesystem / instruction-file)
3. The four modules (Memory · Knowledge · Actions · Guardrails)
4. The evolution/graduation engine (the differentiator — deliberately last; it consumes 1–3)

**The first vertical slice that proves the whole loop end-to-end:** run an agent → emit a trace → run the Actions+Knowledge eval lens over it → the trace-miner files one *retire-unused-tool* or *high-failure-upgrade* proposal → it appears in the promotion inbox → a human approves → a new generation is pinned with the changed tool-set → the Evolution tab shows gen N→N+1 with the eval delta.

**Open questions (non-blocking):**
- Trace-miner: rules-based first (n-gram recurrence, failure thresholds) vs an LLM-judge pass — start rules-based.
- Proposal granularity: per-signal vs a batched per-agent "graduation review" — lean batched/scheduled.
- **AGE vs relational+CTE+pgvector** benchmark (the memory top-tier "prove-it").
- **Workflows prove-it:** can one CF Workflows instance host a multi-round agent loop within execution/duration limits? (`waitForEvent` solves *pause*, not *loop-length*.) — note: largely dissolved by running only the *evolution* loop on Workflows, not the agent loop.
- **Trace schema:** must capture per-tool input+output per call, tagged by tool+version, replayable — it powers both the eval lens and golden-replay.
- Episodic Memory vs semantic Knowledge substrates (likely different); whether Cognition evolves on a substrate ladder of its own; whether Actions/Memory/Knowledge share retrieval infra at the vector tier.

---

## 13. Product experience & roadmap — the six workstreams (added 2026-06-12)

With the spine built (observe + serve on 5 hosts; the local evolve loop proven in exp-14: 43 sessions mined, ~80% tool-call reduction from grounded knowledge), the bottleneck moved from *capability* to *experience*. This section records the product-experience vision and the decisions made on 2026-06-12.

### Positioning, broadened

**zuzuu turns any project folder into an AI-first directory.** The user keeps their folders, files, and working style; `zuzuu init` adds an opinionated external harness — the module home plus serving/observing mechanisms — so the terminal agent they already run works over that directory more efficiently (fewer tokens, less time, better output), with the human always in control. Coding is the **first vertical**, not the boundary: the same mechanism serves any folder-based knowledge work (an accountant's books, a CEO's briefings) — that's what the marketplace workstream (W4) makes concrete.

**Philosophy, stated explicitly: enhance, never reinvent.** We don't reinvent files/folders, file preview, terminals, task formats (a future tasks module is YAML-native, DevOps-shaped), or the host's agent loop. The differentiators are open source, local-native, and the graduation loop — everything else is borrowed, battle-tested practice.

### The six workstreams (dependency order)

| # | Workstream | What it is | Status |
|---|---|---|---|
| **W1** | **Home & onboarding** | the hidden `.zuzuu/` home (decision below), the narrated `zz init` experience, the self-explaining directory contract | **in build (now)** — it gates W2/W4 and the education story |
| **W2** | **Visual workbench** | a local app for non-terminal users: file tree \| **embedded terminal** \| file preview. **zuzuu-web evolves into this** — the read-only observe dashboard (shipped) is the workbench's first milestone, same daemon + app, growing panes | **shipped + iterating** — workbench v1 + Mobbin redesign live; session-management ladder **A→D shipped** (concurrency/manifest/replay — see §14) |
| **W3** | **Module health & HITL UX** | make "is it actually improving?" visible — review-ceremony polish, per-module health surfaces, eval-ranked inbox | design |
| **W4** | **Marketplace templates** | persona-opinionated home templates (accountant, CEO, …): a template = a `.zuzuu/` layout + seed modules. Only after the W1 contract is stable | concept |
| **W5** | **Workflows/tasks module** | task management + scheduled workflows/triggers as a module — YAML-native, mirroring DevOps practice, never a bespoke format | concept |
| **W6** | **Efficiency benchmark** | the rigorous token/cost/time comparison (§2's falsifiable test); exp-14's ~80% lift is the informal precursor | deliberately deferred — premature before W1–W3 |

### Decisions recorded (2026-06-12)

- **The home is hidden: `agent/` → `.zuzuu/`.** Reverses the 2026-06-11 visible-`agent/` decision, with cause: `agent/` is a common directory name (clash risk in brownfield repos), and un-announced visible folders read as clutter, not transparency. The model is `.git`: **transparency comes from porcelain** — `zz status` / `zz explain` / `zz digest`, the digest brief, the workbench — plus plain-text files inside and the human gate, not from an un-dotted dir. The only visible footprint of `zz init` is the managed modules block in CLAUDE.md/AGENTS.md and three `.gitignore` lines. Inner layout is byte-identical; clean break (no users existed), one-shot migration gated on `agent/agent.json` so unrelated `agent/` dirs are never touched.
- **The workbench's middle pane is an embedded terminal** (xterm.js running the real host CLI), not a custom chat UI. Zero reinvention, observe-model intact (we never drive the host), every host works day one. A chat UI over OpenCode's server API stays a possible later enhancement, not the foundation.
- **ONE package, ONE repo (decided 2026-06-12, superseding the brief two-package design the same day):** the workbench lives in this repo at **`web/`** (absorbed from the webcode repo via git subtree, history preserved; a self-contained nested project — own lockfile/vitest, NOT a root workspace, so the root stays no-build/hermetic) and ships **inside `@zuzuucodes/cli`** as `web-app/` (staged by `scripts/build-web.mjs` in the publish pipeline). The web runtime's deps are the CLI package's **`optionalDependencies`** — `dependencies` stays empty and the CLI core never imports them, so a failed native build (node-pty) degrades the workbench, never the CLI; `--omit=optional` is the light install. ADK-style product statement: `npm i -g @zuzuucodes/cli` is the whole product — CLI + workbench, one install, one version, one OIDC pipeline. There is **no `@zuzuucodes/web` npm package**. `zuzuu web` resolves: repo dev build → staged `web-app/` → PATH → repair hint.

### Monetization hypotheses (added to the §6c list — flagged, not decided, not built)

- **(d) Cloud sandboxes** — the user's project directory hosted in a fly.io sandbox, the full zuzuu harness running there, accessed from browser/mobile (remote workbench). Charged as usage with a markup. Open source + local-native stays free; *cloud convenience* is the paid layer.
- **(e) zuzuu-codes broker** — for users who run no host and want none: a natively-integrated host built **over pi** (Stage 3 alignment, §6), with zuzuu as the inference broker. Never an OpenCode fork, never from scratch.

---

## 14. Session management — the maturity ladder (added 2026-06-17)

Sessions are the workbench's core unit (W2). A 2026-06-16 research pass (cloud terminals, devcontainers, Fly Machines, Claude Squad / Vibe Kanban / ccmanager) graded session capability on a **maturity ladder L1→L7** and set a wave sequence toward **portability** (move a session across machines / to cloud and back, work + context + replay intact). Verdict on reuse: **nothing embeddable** (every tool is a whole app; AGPL on Claude Squad/Daytona/Coder) → **build on thin native primitives** (git worktrees) and reuse only license-clean MIT libs (`@xterm/headless`+serialize — already used, `asciinema-player` — already used, Fly Machines API, Mutagen). Full spec + the six resolved decisions: `docs/specs/2026-06-16-session-management-roadmap-l2-to-l7.md`.

Foundation already in place: each session is a `zz/session-*` git branch (W2.2), and PTYs persist server-side with serialized-snapshot replay (zuzuu-web). The ladder builds up from there.

**Shipped (local tier, merged to `main` 2026-06-17 — all rigorous TDD, characterization-first on session-git, the flow-controlled PTY hot path untouched):**
- **A — resilience (L3):** client reconnects **indefinitely** with capped backoff + `online`/`visibilitychange` wake triggers, so sleep/blips recover on their own (the server already persisted PTYs + snapshot-replay).
- **B — concurrency (L4):** **a git worktree per session** (own checked-out dir + branch, shared `.git`, under `.zuzuu/.worktrees/`) → N agents run at once without fighting over the single working tree; the host hook defers in-worktree branch ops to the daemon; the single-active-agent UI guard is lifted; `doctor` prunes/surfaces orphans.
- **C — portable manifest (L4):** a **content-addressed, git-tracked session manifest** (`.zuzuu/manifests/<id>.json`) — the durable session *definition* (host, branch/commit, trace pointer, counts) and the portability unit — plus `session restore` (re-open the worktree, or recreate a gone branch from the recorded commit).
- **D — navigable replay (L5):** OSC 133 command boundaries → asciicast `m` chapter markers in the recording (asciinema-player already seeks; custom I-frame machinery was assessed as premature).

**Designed, NOT built — infra-gated, awaiting accounts + explicit go (don't treat as present):**
- **E — runtime isolation (hybrid):** optional container-per-worktree via `devcontainer.json` for agents that run servers/tests/migrations. **§7 decision: opt-in, deferred until users hit runtime collisions** (interim mitigation: a per-session port-hash helper).
- **F — Fly local↔cloud sync:** keep the project dir local (source of truth) while agents run in a Fly Machine, mirrored both ways via **Mutagen over Fly's WireGuard mesh** + git-native reconciliation, with `suspend/resume` for idle. The portability enabler; needs a Fly account/credentials.
- **G — portable sessions (L7):** compose C (manifest) + E (workspace def) + F (sync) + A (transport) to move a session across machines / to cloud and back. (Stretch: a browser-native runtime spike — deferred; L7 is delivered via the Fly cloud tier, not an in-browser runtime.)
- **H — sharing/collab (L6):** observer/collab links (upterm-style read-only + force-command on a relay); slots after F (needs the relay cloud introduces).

These last waves can't be hermetically TDD'd or honestly verified without provisioned infra, so they stay design-only until the cloud tier is greenlit.

---

*This README consolidates the prior concept and design docs into one entry point. The source audits and the full 100-project survey remain under [`inspiration/`](inspiration/) as the reference shelf.*

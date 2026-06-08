# Agent Foundation — the primitives, in three layers

> **Status:** foundation, 2026-06-06. The canonical primitive model for zuzuagents. Grounded in the 106-project [`inspiration/agent-harness-survey.md`](inspiration/agent-harness-survey.md); deepens [`agentic-platform-concept.md`](agentic-platform-concept.md) + [`core-hypothesis-and-evolving-faculties.md`](core-hypothesis-and-evolving-faculties.md).
> **Vocabulary note:** this doc establishes the canonical names. The concept + core-hypothesis docs still call the semantic faculty **"Memory"** — under this foundation that faculty is **Knowledge**, and **Memory** now names the *episodic* faculty. Those two docs are to be migrated in a follow-up pass.

## The one-line story
> An **agent** is a durable entity composed of **evolving faculties**, running on a **runtime**, grown by an **evolution engine**. The engine *observes* the faculties running, *evaluates* what it sees, and *graduates* them into new generations — human-gated. The system **learns from the observability traces of previous runs**: that loop is the whole product.

Organizing principle for the three layers: **be / run / evolve** — for any primitive ask *is it part of what the agent **is** (faculty), what **runs & bounds** it (runtime), or what **grows** it (engine)?*

---

## ① The Agent — what it *is* (faculties; each graduates generationally)

| Faculty | Owner | Role — one line | Evolves by |
|---|---|---|---|
| **Memory** *(episodic)* | **zuzu** | what happened to *me* — recollection of past runs/conversations; the instructions/persona **seed → conversation scaffolding → historic-conversation analysis → steering** | distilling the trace into curated episodic recollection; reflection |
| **Cognition** | **Host** | how it *thinks* — the reasoning loop (think→act→observe→terminate), planning, decomposition, goal-tracking | *not graduated by us* — the host's loop; **steerable** via injected scaffolding |
| **Knowledge** *(semantic)* | **zuzu** | what's *true* — domain facts, subject-matter / operating-domain expertise | extraction + entity-resolution + reflection; **substrate ladder** `md → relational → graph → vector` (earned tier promotions) |
| **Actions** *(procedural)* | **zuzu** *(split)* | how to *do* things — actions/toolkits/skills (the *unit* is still a "tool"/tool-call; **Actions** is the faculty) | the **selection-burden ladder** `single → agent-decided → schema-assisted → retrieved → crystallized → service` + contents lifecycle. *Our MCP tools = owned & evolved; the host's built-in tools = observed (via hooks), not owned.* |
| **Workspace** | **Host/user** | *where* it acts — the user's real machine/repo (our sandbox is only for *our* Action execution) | host-provided; isolation level when *we* run code (in-proc → container → microVM) |
| **Guardrails** | **zuzu** | its *membrane* — input/output sanitization (injection, PII, schema, moderation, redaction) | inspector rules in an ordered gate pipeline; pinned in the generation |
| **Model** | **Host** | the *engine* the faculties run on | the host's subscription/choice — *we observe, don't pick or pay* |

**The agent is co-owned.** zuzu is *not* the agent runtime — it **wraps the user's existing coding agent** (Claude Code / Codex / Gemini CLI). The **Host** owns **Cognition · Model · Workspace** (we observe them, steer Cognition only via injected scaffolding, and never graduate them). **zuzu** serves & graduates **Memory · Knowledge · Actions · Guardrails** — and each crosses the serving boundary (MCP / instruction-file / hook), so the eval lens gets its faculty-operation trace. See *The deployment model* below.

**The deep structure — three of the faculties are the three cognitive memory systems**, distinguished by content:

| Faculty | Cognitive system | Content |
|---|---|---|
| **Knowledge** | semantic memory | facts about the world/domain |
| **Memory** | episodic memory | the agent's own experiences (runs, conversations) |
| **Actions** | procedural memory | skills — how to do things (literally Voyager's "skill library") |

*Knowledge is about the world; Memory is about the self's experience; Actions are the self's skills.* **Cognition** reasons over all three; **Model** is the substrate they run on; **Guardrails** the membrane; **Workspace** the arena.

**Closing the loop:** the engine's **Observability/traces are the raw episodic stream**; **Memory** is the agent's *curated* recollection distilled from it. The evolution engine literally feeds the Memory faculty.

---

## ② The Runtime — what *serves faculties to a host we don't run, observes it, and runs the evolution loop*

Because the **host** owns the agent loop + inference, zuzu's runtime is **not** "run the agent." It is the layer that **serves faculties, captures the boundary trace, and durably runs the async evolution loop.** The five primitives, reframed:

| Primitive | Role (reframed for the wrap-the-host model) |
|---|---|
| **Activation** | *when zuzu acts* — scheduled **graduation reviews** + on-demand faculty calls. The *user* drives the agent loop from their terminal; zuzu's "heartbeat" is the evolution review, not the agent wake. |
| **Durable execution** | runs **only the async evolution loop** (eval → propose → graduate) on Cloudflare Workflows + `waitForEvent` — **not** the hot agent loop (the host's). This *dissolves* the CF-Workflows loop-length risk. |
| **Budget** | tracks **faculty-execution cost** (our sandbox/embeddings = Labs credits) + **observes** host token spend (we don't enforce the host's inference). The shared envelope still bounds *our* work. |
| **Identity & permissions** | unchanged core — user identity, per-user faculty scoping, secrets for *our* Action execution (proxy-side injection so the sandbox never holds the raw secret). |
| **Inference** | **the host's** for the agent loop (free to us). zuzu's *internal* LLM ops (extraction, eval-judge, proposals) run on **our own cheap model** — until **MCP Sampling** lets us run them on the user's model (north-star; not host-supported today). |

---

## ③ The Evolution engine — what *grows* it (observes ① running on ②, graduates them)

```
Observability/traces  →  Evaluation  →  Generations  →  Governance (human async loop)
   (capture the run)      (judge it)     (pin/rollback)   (approve the promotion)
```
- **Observability** — the typed, append-only, tree-shaped trace of every run (the keystone artifact; also the raw episodic stream for Memory).
- **Evaluation** — scores the trace; swappable scorer (assertion → LLM-judge → human). *Distinct from observability: capture vs judge.*
- **Generations** — the spine: an immutable pin of faculty definitions + active pointer + `forkedFrom`; rollback = flip the pointer.
- **Governance** — the human, async, out-of-band: approves a proposal → it becomes a new generation. The trace-miner proposes; the human disposes.

---

## The deployment model — zuzu wraps a host you already run
zuzu is **terminal-first** in *experience* and **MCP-core** in *mechanism*. Users already pay for Claude Code / Codex / Gemini — zuzu must **not** sell inference or run a competing loop. It rides on top, in three rings:

1. **MCP core (host-agnostic backbone)** — faculties served over MCP: **Tools→Actions · Resources→Knowledge/Memory recall · Prompts→scaffolding (weak — so we also write instruction files) · Roots→Workspace scoping · Elicitation→HITL/approval (works on Claude Code today) · Sampling→run our internal LLM ops on the user's model (north-star; *not host-supported yet*)**. Every MCP call is a trace span.
2. **Per-host shim (progressive enhancement)** — instruction-file injection (CLAUDE.md / AGENTS.md / GEMINI.md, `--append-system-prompt`) for scaffolding, available everywhere; **rich hooks on Claude Code** (PreToolUse/PostToolUse/SessionStart/Stop → deeper trace + tool-gating), thinner on Codex/Gemini.
3. **Server control-plane** — stores configs + learnings + generations (user-viewable/modifiable), runs the async evolution loop + CI/CD-style trace analysis. Plus a **local-native mode**: the whole harness = instruction files + a local MCP server (scripts) — non-intrusive, secret-free, optional server sync.

**Positioning:** *the host gives the agent a brain (Anthropic/OpenAI/Google); zuzu gives it an evolving **memory, body of knowledge, skillset, and guardrails** — improved from how you actually work.*

**Faculty-serving surfaces (three, not just MCP):** how the host *consumes* a faculty — pick per faculty/host:
- **MCP** — structured, fully observable (every call = a span). Default for Actions; needs host MCP support.
- **Instruction-file injection** — CLAUDE.md/AGENTS.md/GEMINI.md, with **delimiter-block + auto-cleanup** coexistence discipline (smfs `agent_hint.rs`) + `permissions.deny` on our own metadata. Universal; for scaffolding/hints.
- **Filesystem (mount / virtual-bash)** — serve Knowledge/Memory as files (supermemory/smfs model — audit: [`inspiration/supermemory-smfs-audit.md`](inspiration/supermemory-smfs-audit.md)). **Most host-agnostic** (uses the agent's own `Read/Write/Grep/Bash`, **zero MCP**), best for hosts without hooks/MCP; "flagless grep = semantic / flagged = literal". *Tradeoff:* a raw `cat` isn't a clean span → use the **virtual-bash single-tool** (one `run_bash` tool + shipped tool-description) when observability matters. The filesystem is a *serving interface*, orthogonal to the Knowledge substrate ladder (it presents L3 as files; doesn't replace md→relational→graph→vector). **Local-first:** copy smfs's SQLite push-queue + `dirty_since` versioning + warm cache, **not** its cloud-dependent extraction/index — our semantic tier stays ours.

**Trace tradeoff (honest):** MCP-only sees calls *to us*, not the host's built-in (non-MCP) tool calls. Mitigate by pulling work through MCP + an instruction-shim that routes the agent through us + progressive hooks per host. **Observability completeness ∝ how much the host routes through zuzu.** Trace propagation: **W3C TraceContext via MCP `params._meta`** (host-agnostic, local-first).

### Why interactive-mode-first (a product pillar, not a detail)
zuzu augments the developer's **live interactive** host session and **never drives the host headlessly.** Two Anthropic-structural reasons (audit: [`inspiration/claude-code-pricing-audit.md`](inspiration/claude-code-pricing-audit.md)):
- **Pricing.** Verbatim from Anthropic's docs: *"Starting June 15, 2026, Agent SDK and `claude -p` usage on subscription plans will draw from a new monthly Agent SDK credit, separate from your interactive usage limits."* Headless wrappers (OpenClaw, Hermes via `claude -p`) sit in the **metered** pool (or are forced onto API keys via `--bare`); interactive use rides the **unchanged subscription** pool.
- **Surface.** Hooks/MCP/CLAUDE.md/skills **only fully work in interactive mode** (`--bare`/headless skips them). Interactive is the *only* mode where our wrapping surface exists — so headless wrappers lose exactly what we use *and* get metered. *(Watch-item: Anthropic could later police interactive augmentation; no evidence today.)*

### Model & provider agnosticity — two needs (audit: [`inspiration/model-provider-agnosticity-audit.md`](inspiration/model-provider-agnosticity-audit.md))
- **Need 1 — host-agnosticity.** Because zuzu **wraps & observes** a host loop it does **not drive**, the HostAdapter is an **observe adapter** (entire.io's proven model — audit: [`inspiration/entire-io-host-adapter-audit.md`](inspiration/entire-io-host-adapter-audit.md)), **not** a streaming bridge:
  - a required **`Agent`** interface (detect presence, read/write session, resolve transcript, resume command) + an optional **`HookSupport`** (`installHooks` writes the host's *native* hook config → calls back into one zuzu binary → `parseHookEvent(stdin) → Event`) + optional **capability interfaces** (`TranscriptAnalyzer`/`TokenCalculator`/`FileWatcher`-fallback for hookless hosts) + a **registry** (`detect()` by presence);
  - every adapter normalizes its native hook into **one `Event`** (`SessionStart/TurnStart/TurnEnd/ToolUse/SubagentStart/Compaction/ModelUpdate/SessionEnd` + prompt/model/files/tokens) — the **dispatcher routes by `EventType`, never by agent name**, so the eval lens + faculty graduation stay agent-agnostic. **This `Event` is the basis of zuzu's trace-span schema** ("design the trace once");
  - host **owns model selection**; assume **no shared host model-schema**; **graceful-degradation hook wrapper** (never break the host if our binary is absent); `permissions.deny` on zuzu's own metadata dir (no feedback loop). *(The goose/hermes `run()`/`stream()` streaming-bridge is only for **driving** a host — out of scope.)*
- **Need 2 — internal-inference provider-agnosticity** (zuzu's own faculty ops; **stopgap until MCP Sampling**). A **thin litellm-*style* surface** — one canonical `complete()`/`stream()` + `drop_params`, provider from a `provider/model` string (aider's altitude) — **not** vendoring litellm, **not** continue's ~70 subclasses. Per-faculty model defaulting to one cheap `default`; fallback gated on selection-source + error-type + 402/credit; local models as ordinary descriptors.
- **Reusable pattern:** separate **`api`** (wire protocol) from **`provider`** (id) → a new OpenAI-compatible vendor = zero code.
- **Config = two blocks:** `host:` (adapters; model opaque/host-owned) + `inference:` (`default` + per-faculty overrides + custom `providers` + type-keyed `fallbacks`).

## Verified references (parallel research, 2026-06-07 — see [`inspiration/terminal-first-runtime-research.md`](inspiration/terminal-first-runtime-research.md))
- **OpenClaw** (verified) — "a harness that manages everything *except* the LLM's reasoning"; provider/harness/middleware plugins. **zuzu's exact shape** + the thesis "the harness is eclipsing the frontier model."
- **Hermes** (Nous, verified) — self-improving terminal agent that **extracts skills after 5+ tool calls** → validates the evolving-Actions faculty.
- **MCP gateways** (IBM `mcp-context-forge`, MetaMCP, AgentGateway) — federation + observability proxy patterns; **Cursor hooks** — host-level observe/gate; the **inspector pipeline** (Allow/Deny/RequireApproval) for guardrails.
- **Honesty flags:** **MCP Sampling is NOT host-supported today** (Claude Code issue #1785 open) — don't assume it; **Elicitation IS** (Claude Code). **ACP proxy chains** are the emerging long-term standard (Zed only so far). **Pi/pi-dev unverifiable.**

## Judgment calls (recorded so they can be revisited)
1. **Inference is the host's** for the agent loop; zuzu's internal ops run on a cheap model until MCP Sampling lands. (The earlier "inference is a faculty" call is superseded by the wrap-the-host model — Model is host-owned.)
2. **Goals folded into Cognition** (goal-tracking is *how it thinks toward an objective*); the per-run goal is run *input*, not a standing faculty.
3. **Workspace is host/user-owned** (the real machine/repo); our sandbox is only for *our* Action execution.
4. **Vocabulary:** the faculty is **Actions** (was "Tools"); its *unit* is still a "tool"/tool-call. `Knowledge` = semantic (was "Memory"); `Memory` = episodic (was "conversational intelligence").

## Where each primitive came from (survey grounding)
Faculties trace to survey **Part I** (Model & inference, Instructions/persona, the agent loop, Planning, Working state, Goals, Tools, Tool infra, Memory types, Memory substrate); Runtime to **Part II** (Scheduling/triggers, Durable execution, Persistence, Model gateway, Extensibility) + **Part III** budget/identity; the Engine to **Part III** (Trace, Evaluation, Versioning/generations, Governance). The foundation re-cuts those 25 documented primitives by the **be/run/evolve** principle.

## Migration (follow-up, not now)
- `agentic-platform-concept.md` and `core-hypothesis-and-evolving-faculties.md`: rename the semantic faculty **Memory → Knowledge** (keep its `md→graph→vector` ladder); add the new episodic **Memory** faculty (seed = system prompt; evolves via trace-distilled conversation scaffolding/analysis/steering).
- Add **Cognition**, **Workspace**, and the **Activation/Budget/Identity** runtime primitives explicitly where those docs currently imply them.

## Open (non-blocking)
- Episodic **Memory** vs semantic **Knowledge** substrates: likely different (episodic = append-heavy run/conversation log + summarization; semantic = relational/graph/vector facts) — confirm during build.
- Does **Cognition** evolve on a substrate ladder of its own (ReAct → plan-act → tree-of-thought → learned-planner), and is that earned from traces like the others? (Probably yes — design later.)
- Procedural **Actions** as "procedural memory" suggests Actions + Memory + Knowledge could share retrieval infra (all are "recall over accumulated X") — revisit at the vector tier.

# Inspiration Log

The prior art and influences that shaped zuzuu — a readable index over the deep audits. Each entry is the **influence** and **what we took from it**.

The full source-level audits (and the 100-project field survey) live in the repo at [docs/inspiration/](https://github.com/h1902y/zuzuu/tree/main/docs/inspiration); the prior-art reasoning is in [docs/DESIGN.md §11](https://github.com/h1902y/zuzuu/blob/main/docs/DESIGN.md#11-grounding--prior-art). The convictions these influences produced are in the [[Decision Log]].

A standing principle runs through all of it — **enhance, never reinvent**: borrow the battle-tested layer, keep the wedge (the human-gated graduation loop) for ourselves.

---

## The core influences

**entire.io — the observe / host-adapter shape.**
The closest prior art to zuzuu's host layer (`entireio/cli`, Go, MIT). We took its **observe model**: an `Agent` interface + optional `HookSupport` + capability interfaces + a registry, with every host's native hook normalized into **one `Event`** that the dispatcher routes *by event type, never by host name*. That's why adding a host is one adapter file, and why we **re-parse, never drive** the agent loop. Also borrowed: per-host native hook-writer + one callback binary + graceful-degradation wrapper, git-branch-as-storage, redact-at-write, and `permissions.deny` on our own metadata dir (no feedback loop). entire stops at *system-of-record* — it captures but doesn't evaluate or evolve; **that graduation engine is zuzuu's wedge.**
Audit: [entire-io-host-adapter-audit.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/entire-io-host-adapter-audit.md)

**git's object model — sessions as branches, generations as snapshots, rollback as restore.**
Git is one idea: *a content-addressed key-value store with a history graph on top* — content is write-once, identity is the hash of the bytes, a branch is a movable pointer. zuzuu adopts that whole-cloth: the `.zuzuu/` home is a git citizen, a **session is a `zz/session-*` branch** (the branch *is* the record), a **generation is a content-addressed snapshot**, and **rollback is a restore (a pointer flip, not a `git revert`)**. No parallel blob store.
Audit: [git-from-scratch.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/git-from-scratch.md)

**OKF (Open Knowledge Format) — the envelope: markdown + frontmatter, one fact per note.**
A GoogleCloudPlatform spec for a knowledge catalog as **plain markdown + YAML frontmatter in a git-versioned tree**, vendor-neutral, with only `type` required and unknown keys preserved round-trip. zuzuu arrived independently at the same substrate bets — the **envelope** (`note › module › project`), filesystem-as-API, git-native, an `index.md`/digest for progressive disclosure, a `log.md` change history. External validation of the riskier serving bets; a format to be *compatible with at the boundary* (a future `module export/import`), not adopted wholesale — zuzuu keeps **typed relations + entity resolution + a sqlite index** internally, where OKF leaves links untyped.
Audit: [okf-knowledge-format-audit.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/okf-knowledge-format-audit.md)

**The agent-harness survey — the field, mapped by primitive.**
An exhaustive audit of **100 open-source agent harnesses/frameworks**, organized by the primitive entities of an agent (model, instructions, loop, tools, memory; orchestration/runtime; observability, evals, generations, governance). It shaped the **wrap-don't-drive** stance and several places where zuzuu deliberately overrides the field's dominant pattern: *pin definitions, observe data* (not snapshot/fork the run state); a strict **1:N tree + mirror aliases** (not an arbitrary DAG); **Cloudflare Workflows only** (not adding cron/Temporal/Inngest); a **shared decrementing budget envelope** (not flat per-call caps). Top borrows: a typed append-only **trace** (build first), versioned-definition + `isActive` + `forkedFrom` generations, and proposal-first self-improvement.
Audit: [agent-harness-survey.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/agent-harness-survey.md)

---

## The terminal / workbench layer

**Terminal-over-web standards — adopt where standards exist, build the rest.**
A benchmark of zuzuu's terminal layer against 8 systems (ttyd, code-server, Gitpod/Coder, sshx/tmate/upterm, xterm.js…) plus a standards sweep. The verdict: **no standard exists for the core terminal stream** — render-gated flow control and reconnect-replay are application-layer by necessity, and they're zuzuu's actual moat (best-in-class: ack-after-render flow control, headless-mirror replay, a layered localhost security stack). So we **adopt at the layers that have standards** — ECMA-48 escape codes and OSC 133/7 shell integration (via xterm.js), bracketed paste, asciicast v2 recording — and keep the hand-rolled binary frame protocol and flow control. The structural hedge: a **pluggable transport seam** so WebTransport can slot in for the cloud waves later (gated on native Node HTTP/3 + Fly QUIC stability).
Audits: [terminal-over-web-benchmark.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/2026-06-23-terminal-over-web-benchmark.md) · [terminal-standards-adoption.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/2026-06-23-terminal-standards-adoption.md)

**Composer primitives — adopt the input chrome, own the PTY glue.**
Research for the workbench's conversational composer (prose → a host CLI on a PTY, *not* an LLM API). The decision: **adopt the input chrome** (own-the-code shadcn/Base-UI style — `PromptInput`, `cmdk`, autosizing textarea) but **build everything below the input box**, because no chat SDK fits a PTY substrate (they all impose an LLM-API message model with no raw-bytes chunk type). The structured conversation comes from **the host's own transcript file** — the very transcript `observe` already parses. Turn detection = output-quiescence heuristic; permission prompts go through the raw-control path, never the composer.
Audit: [composer-primitives-research.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/2026-06-23-composer-primitives-research.md)

---

## Host-agnosticity & pricing

**Claude Code pricing audit — the basis for interactive-mode-first.**
The verified grounding for a product pillar. Anthropic's docs (quoted verbatim): from June 15, 2026, Agent SDK and `claude -p` usage on subscription plans draws from a separate metered credit, and `--bare` forces API-key billing *and* skips hooks/skills/plugins/MCP/CLAUDE.md. So headless wrappers (OpenClaw, Hermes) sit in the metered pool **and** lose exactly the surface zuzuu uses — while interactive use rides the unchanged subscription. zuzuu augments the **live interactive** session and never drives the host headlessly. (The audit's verified-vs-directional split is explicit — don't quote the directional numbers without re-checking.)
Audit: [claude-code-pricing-audit.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/claude-code-pricing-audit.md)

**Model/provider agnosticity audit — two distinct needs, kept separate.**
Grounded in goose/hermes/aider/continue/litellm. It split agnosticity into **host-agnosticity** (the observe-adapter; the host owns model selection) and **internal-inference agnosticity** (zuzuu's own LLM ops — a thin litellm-*style* surface, a stopgap until MCP Sampling lets those ops run on the user's model). Shaped both the host-agnostic stance and the parked **credits hypothesis** (zuzuu providing inference for its specialized internal work). Caveat carried forward: lean on goose/hermes; treat OpenClaw as corroborating-only.
Audit: [model-provider-agnosticity-audit.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/model-provider-agnosticity-audit.md)

---

## Also on the research shelf

- **supermemory / smfs** — proves the **filesystem serving surface** (serve Knowledge/Memory as files the agent reads with its own tools). Copy the interface + crash-safe SQLite cache + delimiter-block instruction injection; *not* the cloud extraction (zuzuu is local-first). [supermemory-smfs-audit.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/supermemory-smfs-audit.md)
- **Terminal-first runtime research** — verification of the wrap-the-host shape (OpenClaw "manages everything except the LLM's reasoning"; Hermes extracts skills after 5+ tool calls — validating evolving Actions). Honesty flags: MCP Sampling is **not** host-supported today; Elicitation **is**. [terminal-first-runtime-research.md](https://github.com/h1902y/zuzuu/blob/main/docs/inspiration/terminal-first-runtime-research.md)
- **The redesign research syntheses** — the background reasoning behind the v2 note/module/project model, opinionated git-sessions, and the project↔module boundary: [docs/inspiration/research/](https://github.com/h1902y/zuzuu/tree/main/docs/inspiration/research).

---

> These are influences and reading, not feature claims — for what's actually shipped see the [[Roadmap]]; for the decisions they produced see the [[Decision Log]]. The audits preserve their original verified-vs-directional honesty splits; read them there before citing externally.

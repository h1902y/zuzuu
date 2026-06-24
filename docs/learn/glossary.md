# Glossary — the load-bearing words

> Some words in this codebase carry decisions, and a few are **overloaded** — the
> same word means different things in different files, and mixing them up causes real
> confusion. This page pins the **overloaded** ones (same word, two meanings) + the
> renames. For the **full entity map + relations** — every load-bearing term, organized
> by layer — see [`../ONTOLOGY.md`](../ONTOLOGY.md); this page is its *disambiguator*.

## Overloaded terms — disambiguated

These each mean **more than one thing**. When you read or write them, know which one.

### `agent`
Three distinct meanings — keep them straight:
1. **The host agent** — the coding agent you already run (Claude Code · Codex · Gemini CLI · OpenCode · pi). It supplies the *brain*; zuzuu wraps it. This is the primary meaning.
2. **An agent session** — a PTY session of `type: "agent"`: a host CLI spawned **directly** on the PTY (no shell, no rc injection), whose exit triggers the session-git auto-merge. Contrast a `type: "shell"` session.
3. **`agent` / `agentDir` in the web code** — an unfortunate local variable name for the **`.zuzuu/` home directory** in `server/zuzuu-read.ts` and `server/zuzuu-peek.ts` (`const agent = await agentDir(root)`). This is *not* an agent at all — it's the zuzuu's home dir. (Flagged for a future rename; left for now to keep the refactor surface small.)

### `brain` / `zuzuu`
Decided 2026-06-24 — these two were colliding; pin them:
1. **The brain** — the **host agent's** reasoning loop + the model. The host *supplies the brain*; zuzuu gives it an evolving **body** of modules. This is the foundational *be / run / evolve* framing — **"brain" means only this**, never our folder.
2. **The project's zuzuu** — a project's `.zuzuu/` directory (its notes, modules, generations, log). One repo, one zuzuu (a.k.a. **the home**). This used to be miscalled "the project's brain" — that's the collision we removed (the folder is literally `.zuzuu`, so *the project's zuzuu* is the honest name). It overloads "zuzuu" the product/CLI, but context disambiguates — exactly like `git` the tool vs a repo's `.git`.

There is **no master/aggregate zuzuu** — each project carries its own. Cross-project aggregation (the deferred Enterprise tier) is a **roll-up** (a read-only dashboard over every project's `.zuzuu/`) + an **org module registry** (a curated `.zuzuu/`-shaped repo that fan-out-PRs modules into projects) — never "the brain", never one big zuzuu.

### `session`
1. **A git branch** — the invisible `zz/session-*` branch the zuzuu's session-git layer checkpoints onto; "session = git branch" is the v2 lifecycle model. Squash-merged on end.
2. **A PTY `Session`** — the web daemon's `server/session.ts` class: one pseudo-terminal + its flow control + its headless mirror. Tracked by the `SessionManager` (`server/session-manager.ts`).
3. The two connect: an **agent** PTY `Session` exiting drives the squash-merge of its **git-branch** session (`server/agent-close.ts`).

### `module`
1. **A zuzuu module** — a **generic, goal-shaped collection of notes**, declared by its `module.md`. Modules are an **open set** — any goal can be one (a `roadmap`, a `tasks` module, …); there's no per-module code and no closed taxonomy. The **standard us-owned kinds** are **Knowledge · Memory · Actions · Instructions · Guardrails** — examples with sensible defaults, **not a rule** (the "five types" framing is a v1 artifact from when they were prebuilt). **No prebuilt modules (2026-06-23):** `zz init` ships only **Guardrails** (the safety floor); every other module — standard kind or custom — **materializes on demand** (its `module.md` minted on first proposal) as the loop grows the zuzuu. (Was **faculty** until the `faculty → module` rename; `faculty` now survives only as intentional history.)
2. **A JS module** — an ES module / source file (`import … from "./session-cwd.js"`). The ordinary programming meaning.

### `host`
1. **The host agent** — see `agent` (1): the coding-agent CLI being wrapped.
2. **The HTTP `Host` header** — in `server/auth.ts`, the **Host-header allowlist** that defends against DNS rebinding. Unrelated to the host agent.

### `ApiError`
Two different `ApiError`s, by design-accident:
1. **`shared/rest.ts` → `interface ApiError { error: string }`** — the **wire DTO**: the JSON error body the daemon returns.
2. **`client/lib/api.ts` → `class ApiError extends Error`** — the **thrown client error** (carries an HTTP status). The browser throws this; it never crosses the wire.
   (Flagged for the nomenclature pass — same name, different layer.)

### `daemon`
The **whole long-lived local process** that binds `127.0.0.1`, owns the PTYs and the filesystem, and serves the browser SPA. Deliberately distinct from:
- the **`server/` directory** (where its code lives),
- **`server.ts`** (the Hono app / mount table inside it),
- the underlying **HTTP listener** (`@hono/node-server`).
"Daemon" names the process; the other three are parts of it. (Kept as the term after weighing `engine`/`service`/`server` — `server` was too overloaded with the dir/app/listener.)

## Load-bearing terms

The product-level entities — *the home / a project's zuzuu · envelope · note · module · generation · proposal · observe · the **review gate** vs the **tool (guardrails) gate***  — are defined once in [`../ONTOLOGY.md`](../ONTOLOGY.md) with their relations. This page no longer repeats them; what remains below is **web-internal** vocabulary the ontology doesn't cover.

### Web-specific (the workbench)

- **opcode** — a 1-byte number naming a terminal frame's kind (`shared/opcodes.ts`); `ClientOp`/`ServerOp`. See [the terminal, mechanically](the-terminal-mechanically.md).
- **flow control / backpressure** — the render-gated ack loop (`shared/flow.ts`): the client acks bytes only after xterm paints them; the daemon pauses the PTY above 128 KB unacked. The moat of the terminal layer.
- **the mirror** — the server-side headless `@xterm/headless` terminal that holds current screen + scrollback, serialized into a `Replay` frame on reconnect (`server/session.ts`).
- **TermTransport** — the pluggable transport seam (`server/transport.ts`): the opcode/ack/replay protocol sits *above* it; a `WsTermTransport` backs it today, a WebTransport one could later — without touching `session.ts`/`term-protocol.ts`.
- **term-protocol** — the transport-blind opcode decode/dispatch layer (`server/term-protocol.ts`). *Renamed from `ws-term.ts`* once the transport seam made it `ws`-free.

## Renames & intentional history

When a term is renamed, the code + current docs adopt the new name; **historical records keep the old one on purpose** (LOG.md is append-only; retired specs and dated research are snapshots). Don't "fix" these:

| Old | New | Survives as history in |
|---|---|---|
| `faculty` | **module** | `commands/migrations/` shims · DESIGN terminology notes · LOG.md |
| "the brain" (the `.zuzuu/` home) | **the project's zuzuu** | host-sense "brain" (reasoning loop + model) is KEPT; LOG.md · `docs/{plans,brainstorms,design-research}` · `docs/inspiration/` · the `brain-sync` feature name |
| `ws-term.ts` | **term-protocol.ts** | LOG.md · retired specs · dated `docs/inspiration/` research |
| `sessions.ts` | **session.ts** | LOG.md · retired specs |
| `motorsandsensors` / `mns` | **zuzuu** | older docs (expected, not an error) |

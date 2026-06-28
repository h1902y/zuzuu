# Decision Log

The load-bearing decisions zuzuu has committed to — tech stack, architecture, product. Treat this as the **"don't relitigate without cause"** list: each is recorded with the **decision**, the **why** in a line or two, and its **status/date** where known.

This page is *rationale*, not a feature list. zuzuu's standing wiki rule is **shipped-only for features** — but a decision log records direction too, so where a decision is **design-only / not built**, it says so. Don't read "decided" as "shipped" unless the status says so.

The deeper *why* lives in the repo: [docs/DESIGN.md](https://github.com/h1902y/zuzuu/blob/main/docs/DESIGN.md) (strategy & rationale) and [docs/LOG.md](https://github.com/h1902y/zuzuu/blob/main/docs/LOG.md) (the dated build journal).

---

## Tech stack

**The workbench is a Vite + React SPA over a local daemon (Hono + `ws` + `node-pty`) — not Next.js.**
The workbench is a *local stateful daemon*: it owns real PTYs, a binary-WebSocket terminal (flow-controlled xterm/WebGL), and fs/git/ripgrep, all on `127.0.0.1`. Next.js's SSR / server-component / serverless model fights a persistent stateful process and buys nothing for a token-gated localhost page (no SEO, no SSR benefit). The workbench also ships **bundled inside the CLI as static assets** (`vite build` → `web-app/`), with the CLI core zero-dep and the workbench's deps as `optionalDependencies` — a Vite SPA → static files fits that; Next.js wants its own Node server and a heavier footprint. The greenfield rebuild cut the client **18.1k → 1.7k LOC**. *Right tool per surface.*
**Where Next.js / Vercel does fit: the separate public `zuzuu.codes` site/dashboard** — a different surface (public, SSR/SEO-relevant).
Status: **shipped** (workbench at `web/`, rebuilt greenfield 2026-06-22).

**Zero runtime dependencies for the CLI core.**
`node:test`, `node:sqlite`, hand-rolled OTLP — a brain that installs cleanly anywhere. The workbench's deps ride as `optionalDependencies`, so a failed native build (e.g. `node-pty`) degrades the workbench, never the CLI. Node ≥ 22.
Status: **shipped** (a deliberate, enforced policy — `dependencies` stays empty).

**`node:sqlite` as the index (the keystone bet).**
A lazy, regenerable cache — notes + KV/EAV props + a typed link graph + FTS5 — rebuilt on mtime-staleness. Benchmarked at 5000 notes: build ~157ms / search ~13ms. It's a cache, not a source of truth (the markdown files are), so it can always be thrown away and rebuilt.
Status: **shipped**.

**git is the substrate.**
Session = branch, generation = content-addressed snapshot, rollback = restore. No parallel blob store. Borrows git's own model: content-addressed, write-once, history as movable pointers (see [Inspiration Log](Inspiration-Log) → git's object model).
Status: **shipped**.

**One package, one repo for the workbench.**
The workbench ships *inside* `@zuzuucodes/cli` as `web-app/` (staged at publish), not as a separate published package. `npm i -g @zuzuucodes/cli` is the whole product — CLI + workbench, one install, one version, one OIDC pipeline. There is no `@zuzuucodes/web` npm package.
Status: **shipped** (decided 2026-06-12).

---

## Architecture

**The observe model (Design B) — re-parse the host's own transcript, never drive the agent loop.**
zuzuu *wraps and observes* a host it never drives (the entire.io shape, not a goose/hermes streaming bridge). It can't corrupt a live session, and adding a host = one adapter file + one registry line. Live hooks are a *signal + re-capture trigger*, never a span builder.
Status: **shipped** — observe covers **5 hosts** (Claude Code · Codex · Gemini CLI · OpenCode · pi).

**The human gate is the moat.**
Every write to the brain passes through `review` (the human's approve/reject decision); the agent **proposes**, never commits. The loop is **observe → propose → review → evolve**, every write human-gated.
Status: **shipped**.

**The command table is the single source of truth.**
One declarative table (`src/cli/commands.mjs`) drives four consumers: the router, `zz help`, the guardrails write-verb **deny set**, and the daemon's **spawn catalog**. Add or rename a verb once and it flows to all four — an unlisted command can't exist, and the daemon can only shell a command the table knows.
Status: **shipped** (command-registry redesign, 2026-06-28).

**One write boundary — the moat made structural.**
`src/grow/commit.mjs` is the **sole note-writer and sole minter**: it applies a normalized op batch as one all-or-nothing transaction, then mints one generation per touched module. It refuses `actor: 'agent'` up front, so the agent reaches the writer only through `review`. (This closed an earlier two-writers split — exactly what a knowledge-poisoning attacker would exploit.)
Status: **shipped** (2026-06-28).

**Schema-enforced module tables.**
A module is a table, a note is a row. A `module.md` `fields` block (8 field types) validates every note at the write boundary — a schema-violating note is rejected before it lands. Absent `fields` ⇒ schemaless and flexible (full back-compat).
Status: **shipped**.

**The brain is read-open but write-gated.**
The agent **reads** `.zuzuu/` freely (a blanket deny would starve it of its own modules), but the enforced gate **denies the agent's direct writes** to `.zuzuu/` (session worktrees excepted), so the brain changes only through review. Lives as seeded gate rules (`protect-brain-writes` / `-shell`), fail-open.
Status: **shipped**.

**Interactive-mode-first, never headless.**
Two Anthropic-structural reasons: (1) pricing — interactive subscription usage stays in the unchanged pool while `claude -p`/SDK usage is metered separately; (2) surface — hooks / MCP / CLAUDE.md / skills only fully work in interactive mode. Headless wrappers lose exactly what zuzuu uses *and* get metered.
Status: **shipped as a pillar** (see [Inspiration Log](Inspiration-Log) → Claude Code pricing).

**Evolution engine runtime = Cloudflare Workflows only** — the *async* evolution loop, never the hot agent loop.
Running only the evolution loop (not the agent loop) on Workflows dissolves the loop-length risk; `waitForEvent` handles the human gate.
Status: **design-only / not built.**

---

## Product & positioning

**The three-stage product sequence.**
① host-agnostic wrapper (Claude Code · Codex · Gemini CLI, + OpenCode as a peer) → ② **OpenCode as the default bundled host** (`zz host code` — configure + launch, never fork or drive) → ③ an owned harness on **pi** for granular context/model control, gated on the efficiency benchmark. Never an OpenCode fork, never from scratch.
Status: **stage 1 shipped · stage 2 launcher shipped · stage 3 benchmark-gated** (decided 2026-06-10).

**The hidden `.zuzuu/` home — the `.git` model.**
The home is a hidden `.zuzuu/` folder, not a visible `agent/` dir (reversed with cause: clash risk in brownfield repos + un-announced visible folders read as clutter). Transparency comes from **porcelain** — `zz status` / `zz explain` / `zz digest` + plain-text files + the human gate — not from an un-dotted directory.
Status: **shipped** (decided 2026-06-12).

**Positioning: an AI-first directory for any folder-based work; coding is the first vertical.**
`zz init` turns any project folder into an AI-first directory — the user keeps their files and working style; zuzuu adds an external harness so the agent they already run works over that folder more efficiently, human always in control. Coding is the first vertical, not the boundary.
Status: committed direction (decided 2026-06-12).

**Philosophy: enhance, never reinvent.**
Don't reinvent files/folders, file preview, terminals, task formats, or the host's agent loop. The differentiators are open-source, local-native, and the graduation loop; everything else is borrowed, battle-tested practice. (The workbench's middle pane is an **embedded terminal** running the real host CLI — xterm.js, not a custom chat loop.)
Status: a standing principle.

**Org topology = a strict 1:N tree + mirror aliases** (never an arbitrary DAG).
Every node has exactly one parent → the agent canvas stays a clean tree; sharing is handled by mirror *aliases* of the same agent entity, so every delegation edge stays 1:N.
Status: **design** (the agent-org canvas is a future visual surface).

**Knowledge / Memory substrate = off-edge Postgres / Neon; graph (Apache AGE) and vector (pgvector) are earned top rungs**, not a foundational commitment.
The substrate climbs a ladder `md → relational → graph → vector`; the richer tiers are opt-in and benchmark-gated ("AGE is a prove-it").
Status: **design** (today's shipped substrate is the markdown/`node:sqlite` tier).

**The credits / monetization model is a flagged hypothesis — not decided, not built.**
Several variants exist (zuzuu-as-gateway, Zen-reseller, internal-LLM-ops credits, cloud sandboxes, a zuzuu-codes broker). Open-source + local-native stays free; any paid layer is convenience on top. Parked behind the product, deliberately undecided.
Status: **flagged, undecided, unbuilt.**

**Product-experience build order — six workstreams in dependency order; `zuzuu-web` becomes the one workbench.**
Decided 2026-06-12: the experience ships in order — home/onboarding → workbench → module-health UX → marketplace templates → tasks module → benchmark — and there is no separate web surface (`zuzuu-web` evolves *into* the workbench). The deeper rationale is [DESIGN §13](https://github.com/h1902y/zuzuu/blob/main/docs/DESIGN.md).
Status: **partially shipped** (onboarding + the workbench are built; the later workstreams are ahead).

---

## Conventions (hard-won — violating these has bitten us)

- **Real-wire-data rule.** Adapters/integrations are built and verified against output the host *actually produced* — never from docs alone, never against self-invented fixtures (that's circular). Observe real events *before* wiring lifecycle semantics. (Docs lied twice: Claude `Stop` and OpenCode `session.idle` are per-*turn*, not end.)
- **Golden ids in regression tests are pasted from a real run** — never hand-computed.
- **Verify fixes with `node bin/zuzuu.mjs`, never the PATH `zuzuu`** — the global is the *published* version and silently lacks unpushed code.
- **Hooks/plugins must never break the host** — always exit 0, spawn detached, degrade silently. The guardrails gate **fails open**: engine/rule errors emit no decision, never a block.
- **Secrets never land in tracked files** — scan before commit/push; generated host-enablement config is git-ignored.
- **The wiki is generated, not hand-edited.** The user guide's source of truth is `docs/guide/` in the main repo (reviewed in PRs, atomic with the code it documents); a GitHub Action (`publish-wiki.yml`) mirrors it to the `/wiki` tab on every merge to `main`. So the wiki can't drift from the repo — edit `docs/guide/`, never the wiki directly. *(2026-06-28 — superseded the earlier "hand-authored wiki, no automated sync" convention, which drifted after every redesign.)*

---

> Shipped vs designed is marked per entry above. For the implementation map see the repo's [CLAUDE.md](https://github.com/h1902y/zuzuu/blob/main/CLAUDE.md); for the prior art that shaped these calls see the [[Inspiration-Log|Inspiration Log]].

# Frontend audit — the workbench, the galaxy, and the merge (02-07-2026)

> Provenance: deep audit of `web/` + `bin/zuzuu-web.mjs` + `src/serve/` (the workbench) and `~/Documents/startpage` (the galaxy), against the goal of ONE frontend where "conversing about your project keeps building your personal application." Companion docs: `2026-07-02-backend-audit.md`, `2026-07-02-integration-seams-audit.md`, roadmap in `docs/specs/2026-07-02-personal-app-roadmap.md`.

## Part 1 — What the workbench IS today

**Stack** (`web/` = `@zuzuucodes/web` v0.1.0, rebuilt greenfield 22-06-2026, strict DAG `shared → {server, client}`):
- **client/** ~7.8k LOC TSX: React 19, TanStack Query 5, Zustand 5, Tailwind 4, cmdk palette, lucide-react, xterm.js + WebGL addon, Vite 8. Ships pre-built static assets (client deps are devDependencies).
- **server/** ~4.6k LOC: the long-lived daemon — Hono + ws, @lydell/node-pty + @xterm/headless (PTY mirror), chokidar, @agentclientprotocol/sdk. Root CLI's `optionalDependencies` → a failed native build degrades the workbench, never the CLI.
- **shared/** 640 LOC wire contract: 1-byte binary terminal opcodes, flow, rest, zuzuu DTOs.
- Entry: `bin/zuzuu-web.mjs` imports staged `web-app/dist/index.js`; `zz web` resolves bundled-vs-dev-vs-PATH, reuses a live singleton.

**Maturity: HIGH.** 0 TODO/FIXME in web/src; **80 test files** (vitest server+client+e2e); TS strict + noUncheckedIndexedAccess; the 22-06 squeeze pruned ~30 dead routes. The most polished asset in either repo.

**Views** (`web/src/client/shell/`, "Stage + Wings" frame — nav · stage · wing + ribbon):

| Surface | File | Notes |
|---|---|---|
| Module table | `stage/Grid.tsx` | filterable/sortable/paginated; schema-aware columns; server-side SELECT |
| Module graph | `stage/ModuleGraph.tsx` | **stub** — fixed circular SVG (R=380), no physics/zoom/cards |
| Note record | `stage/Record.tsx` | single-note stage |
| Note editor + schema | `wing/Form.tsx`, `wing/Schema.tsx` | writes go through the gate as proposals |
| **Review queue (the moat)** | `review/ReviewQueue.tsx` | cross-module proposals, keyboard triage (j/k/a/d), diff preview; session wing AND global overlay (`R`) |
| Sessions | `term/TermView.tsx` + `composer/Composer.tsx` | live PTY panes; Composer = remote keyboard into the agent TUI; Changes tab = per-session ReviewQueue |
| ACP drive-lane | `stage/AcpView.tsx` + `server/acp.ts` | structured agent conversation off the TUI |
| Overview/home | `overview/Overview.tsx` | dashboard + onboarding checklist |
| Onboarding | `onboarding/` | per-rung consent: git-init → init → enable → session → review |
| Search / Settings / Palette | — | ripgrep search, ⌘K cmdk |
| Held-session merge gate | `review/SessionCloseCard.tsx`, `/api/zuzuu/held` | the CODE moat mirroring the brain moat |

**Backend discipline:** client→daemon = HTTP JSON + WS (`/ws/term/:id` binary, `/ws/fs` chokidar, `/ws/acp/:id`). Daemon→backend: **shells the zz CLI only — never imports src/**. Single spawn site (`server/zuzuu-cli.ts`); argv built only from the typed `COMMAND_CATALOG` (`zuzuu-catalog.ts:36-60`), byte-equality-pinned to the CLI's generated catalog by a test; unknown commandId = tsc error + runtime refusal.

**The write inversion (moat as data semantics):** `data/provider.ts:62-82` — create/update/delete/relate resolve to a **PENDING StagedChange**, never a landed row. The row lands only on human approve. The gate falls out of the DataProvider contract.

**Security:** localhost-only bind (non-loopback requires `WEBCODE_HOSTED=1` sandbox); AuthGate = Host allowlist (anti DNS-rebinding) + Origin allowlist (anti CSRF/WS-hijack) + token → HttpOnly SameSite=Strict cookie (stateless sha256, survives restarts); WS upgrades gated identically. **Moat vs agent:** actor stamp (`src/serve/api.mjs:56`) + generated execution gate (`commands.mjs:894-946`) denies agents all write verbs; agent's sanctioned channels = `observe` + `stage`; `review approve` is `gate` permission, human-only; ACP lane routes every tool call through `zz hook PreToolUse`.

**Live updates:** terminal/fs/ACP are real-time; **brain data is NOT pushed** — TanStack invalidate-on-mutation. A proposal staged mid-agent-turn appears only on refetch. Biggest single gap for "watch it build."

## Part 2 — The galaxy (startpage), confirmed

Vanilla JS, no build, ~2.4k LOC + vendored d3. `bridge/server.mjs` (468 lines): zero-dep http on 127.0.0.1:7457; **imports zuzuu's `src/notes/index.mjs` directly** (the opposite of the daemon's discipline); shells allowlisted read verbs; spawns `claude -p --output-format stream-json` prefixed `/hi`; origin-check-only security (no token). `extension/graph.js` (827): two-level force world — metaSim module bodies (repel −1400, collide on live island radii, affinity links from cross-module edge counts) driving note sim via custom forceFollow; semantic geography; constellation chips (drag island / click card); kBand semantic zoom; entrance pour; biography replay; World API (flyTo/fit/highlight/glow/setLens/…). `cards.js`: L2 mini-cards → L3 full-note reader; "discuss →" wires into the omnibar conversation. `omnibar.js`: one input, three modes (search / `/` converse / `>` commands). `newtab.js`: no-innerHTML markdown renderer; `[[wikilinks]]` in assistant text glow nodes. Hardcoded 5-module list — vault-specific.

**Key fact for the merge: the galaxy is read-only + agent-spawn. No write path, no review surface — when `/hi` stages a proposal, the moat is invisible.**

## Part 3 — Merge analysis

- **Workbench = the engine**: daemon, write authority, moat (actor stamping + exec gate + DataProvider inversion + ReviewQueue), PTY/sessions/ACP, security. Weak: map is a stub, brain data not pushed, utilitarian UI.
- **Galaxy = the face**: the living-world conversational UX the thesis is about. Weak: no writes, no review, weak security, internal-import coupling, vault-hardcoded.

**(a) Galaxy absorbs workbench — REJECT.** Rebuilds the terminal stack (xterm+WebGL+flow-control+PTY+replay — least reusable, highest value), re-implements review/grid/sessions/onboarding in vanilla JS, re-hardens the bridge to daemon-grade auth. Throws away ~13k tested LOC.

**(b) Workbench absorbs galaxy — STRONG, the path.** Galaxy ports as a framework-agnostic `client/world/` lib (d3 owns the DOM in a container ref; React owns the shell), replacing the `ModuleGraph.tsx` stub. graph.js/cards.js/omnibar move nearly verbatim. One friction: daemon must not read sqlite → needs a **`zz graph --json` CLI verb** (fits the catalog pattern). Lost: zero-build simplicity + standalone new-tab deployment.

**(c) Both thin clients over one daemon API — the destination, over-scoped as step one.** Daemon = sole local API (graph, notes, gated stage, review, sessions, agent stream, layout); bridge retired; galaxy could stay a new-tab renderer of the same API later.

**Recommendation: (b) as the path, (c) as the destination.** The daemon is already the secure, tested write-authority — extend the API that has the moat rather than build a new one. Payoff is the founder-loop made visible: **omnibar `/` conversation → agent stages proposals (its sanctioned channel) → ghost nodes with halos light up in the map → human approves in an in-map review overlay → the node solidifies into the world.**

**Survives from the workbench:** entire server/ daemon + auth + zuzuu-cli/catalog/read/write, SessionManager + term stack, ACP lane + guardrails gate, DataProvider inversion + ReviewQueue + ProposalCard + SessionCloseCard, shared/zuzuu.ts contract, TanStack layer.
**Survives from the galaxy:** graph.js two-level world, cards.js semantic zoom, omnibar three-mode input, markdown renderer + stream-json handling, design language, positions persistence; bridge's /graph + /dashboard build logic (moves into `zz graph --json` / daemon route).
**Dropped:** the bridge server (absorbed); ModuleGraph.tsx stub (replaced); hardcoded module list (generalized via /overview); three conversation surfaces collapse toward the **ACP lane** (already guardrail-gated).

## Gap list

1. Galaxy has no review/approval surface — the moat is invisible in the map. (Highest)
2. Galaxy has no write path at all.
3. Two backends with opposite discipline and security (bridge: src-import + origin-only vs daemon: catalog + token/cookie/Host/Origin).
4. Brain state isn't live-pushed anywhere (TanStack invalidate ≠ push). Fatal for "watch it build."
5. Workbench map is a toy vs the galaxy's force world.
6. Galaxy is vault-specific (hardcoded modules, journal/social aggregation).
7. No shared design language (Tailwind tokens vs bespoke glassmorphism).
8. Conversation lives in three places (galaxy /agent claude -p · Composer PTY · ACP lane).

## Five highest-leverage frontend investments

1. **Unify on the daemon API; retire the bridge.** Add `zz graph --json` → `/api/zuzuu/graph`; add `/api/zuzuu/positions`; fold the agent stream in. Deletes a divergent insecure backend; galaxy inherits daemon auth.
2. **Galaxy in as the primary map surface** — port graph.js/cards.js as `client/world/`, thin React `<World/>` mount, replacing ModuleGraph.tsx.
3. **Render the moat IN the map** — staged proposals as ghost/pending nodes with halos; in-map review overlay reusing ReviewQueue/ProposalCard; approve → node solidifies. The founder-loop, literally rendered.
4. **Live push for brain state** — SSE/WS channel for module counts + review queue + newly staged nodes (pattern exists at `/ws/fs`); invalidate-on-push replaces invalidate-on-mutation.
5. **Consolidate conversation onto the gated ACP lane + unify design tokens** — the galaxy's omnibar drives ACP; wikilink mentions glow; tool calls flow through the guardrails gate; one Tailwind token set across map + shell.

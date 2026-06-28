# CLAUDE.md

Guidance for Claude Code when working in `web/` — the zuzuu visual workbench.

## What this is

The **workbench**: a browser-based terminal + file explorer + Monaco editor + the
modules dashboard for your local machine. A **local daemon** runs on `127.0.0.1`;
the browser connects and gets a real PTY shell (xterm.js + WebGL over a binary
WebSocket), a file tree, an editor, git, and the zuzuu brain surface. Sessions
survive page reloads. `zz web` (the root CLI) launches it.

**One folded package** (`@zuzuucodes/web`), rebuilt greenfield 2026-06-22 — it
replaced a 3-package npm workspace (`protocol`/`daemon`/`web-ui`). The SPA was
rebuilt from scratch (**18.1k → 1.7k LOC**, the bloat cut); the proven daemon
engine was ported, not rewritten (the tests are its proof). Rationale + the rung
sequence: the greenfield-rebuild entry in [`../docs/LOG.md`](../docs/LOG.md).

## Commands

```bash
npm install
npm run typecheck            # tsc --noEmit
npm test                     # vitest run — server + client + e2e (137)
npm test -- pty-roundtrip    # one file by name filter
npm run dev                  # dev:daemon (tsx, :7770) + dev:client (Vite, :5173 → proxies /api,/ws,/auth)
npm run build                # tsc(server+shared) + vite(client) → dist/{server,web} → staged into ../web-app/
node dist/server/cli.js ~/some/repo --no-open --port 7771 --token dev   # run the built daemon directly
```

There is **no build step for tests** (vitest runs the TS sources). The daemon's
runtime deps are the **root CLI's `optionalDependencies`** (so a failed `node-pty`
native build degrades the workbench, never the CLI); the client deps are
`devDependencies` (the SPA ships as pre-built static assets).

## Architecture — one package, three source domains

A plain DAG: `shared/` is the only thing both halves import (`shared → server`,
`shared → client`, no edge back). TypeScript strict + `noUncheckedIndexedAccess`.

- **`src/shared/`** — the wire contract, imported via the `#shared/*` subpath.
  `opcodes` (1-byte binary terminal frames: `ClientOp` Input/Resize/Ack ·
  `ServerOp` Output/Exit/Replay/Title/Cwd), `flow` (the flow-control watermarks),
  `rest` (the JSON REST DTOs), `zuzuu` (the modules-dashboard contract). Was the
  published `@zuzuu-web/protocol` package — now a plain internal module, so there
  is no vendor step and no client/server version skew.

- **`src/server/`** — the long-lived daemon (Hono + `@hono/node-server` + `ws`).
  Entry: `createDaemon()` (`index.ts`) is the testable factory; `cli.ts` is the
  bootstrap (port scan, token, singleton instance file, browser open, the
  `WEBCODE_HOSTED` gate) run by `bin/zz-web.js`. The hot core is **logic-frozen**
  (port-faithful, the tests pin it): `session.ts` (the core state machine — PTY + a
  headless `@xterm/headless` mirror + 128 KB flow control; its side-concerns split out to
  `session-cwd.ts`, `session-recording.ts`, and the `session-manager.ts` registry),
  `term-protocol.ts` (binary frames + the ack loop),
  `safe-path.ts` (the realpath/lstat symlink jail), and `transport.ts` (the pluggable
  `TermTransport` seam — the protocol sits above it, so a future WebTransport slots in
  below without touching `sessions`/`term-protocol`). Plus `fs-api`, `search`
  (ripgrep), `ws-fs` (chokidar), `cast` (asciicast), `shell-integration/` (OSC
  133/7 injection), and `zuzuu-cli.ts` — the **only** place the daemon shells the
  `zz` CLI (every brain mutation goes through it; the daemon never imports `src/`).
  It builds argv **only** from `zuzuu-catalog.ts` (`COMMAND_CATALOG`), a typed mirror
  of the CLI's generated catalog (`zz commands --json` ← `src/cli/commands.mjs`): a
  `commandId` is `keyof typeof COMMAND_CATALOG`, so a typo is a **tsc** error and an
  unknown id at runtime is **refused** (`buildZuzuuArgv` throws). The daemon can only
  shell a command the CLI table KNOWS — closing the class of bug where it once shelled
  nonexistent verbs (`module new` / `generation mint`); byte-equality with the live
  catalog is pinned by `zuzuu-catalog.test.ts` (drift fails CI). `zuzuu-routes.ts`
  composes the modules-dashboard API from `zuzuu-read.ts` (GET) · `zuzuu-write.ts`
  (CLI-only mutations) · `zuzuu-peek.ts` (the CLI-absent fallback + shared id guards). **The surface is
  trimmed to what the client actually calls** — beyond the v1 dead routes
  (checkpoints, OTLP session views, eval/inbox), the 2026-06-22 squeeze pruned the
  ported-but-unused features too: git, workflows, shell-history, vault-browse,
  recording-capture, and the session-git/digest/diff read surface (~30 routes).
  `server.ts`'s route registration was then decomposed: the `/api/sessions` surface
  (argv validation + the Wave-B worktree orchestration) lives in `sessions-routes.ts`,
  the SPA static handler in `static.ts`, the shared ripgrep probe in `rg.ts`, the
  WS-upgrade auth in `AuthGate.upgradeAllowed()`, and the agent-exit hold/merge
  orchestration in `agent-close.ts` (END holds for the merge gate — branching on
  `usesWorktree` × the `autoMerge` opt-in) — `server.ts` is now a table of mounts.

- **`src/client/`** — a fresh, lean Vite + React 19 + Tailwind v4 SPA the daemon
  serves from `dist/web`. `term/` (xterm + WebGL + `connection.ts`, the binary-WS
  client reusing the ack/flow-control loop + indefinite reconnect), `explorer/`
  (tree + `/ws/fs` + ripgrep), `editor/` (lazy Monaco),
  `panel/` (the right panel — files mode = the editor, modules mode = the
  brain dashboard with per-module generations + approve/reject), `data/` (the
  `DataProvider` over module-as-table: `getList` paginates the server-side
  filter/sort query, and every row op — `create · update · delete · deprecate ·
  relate · unrelate` — **stages a proposal** the review gate governs, never a direct
  mutation: THE INVERSION; `relate/unrelate` carry a relation EDGE, the `link`
  FieldType's writable link field), `shell/wing/` (the typed grid + Form — a module's
  `schema` `fields` drive the columns + the edit form, so the dormant FieldType
  apparatus is now the live CRUD surface), `palette/` (cmdk),
  `preview/` (asciinema CastView), `state/` (zustand + TanStack Query).

- **`cloud/`** — the deferred SaaS skin (untouched by the rebuild). `cloud/broker`
  provisions per-user sandboxes (`BROKER_BACKEND=local`|`fly`); `cloud/sandbox` is
  the Docker image + `fly.toml` running the daemon with `WEBCODE_HOSTED=1`. The
  `Backend` interface in `cloud/broker/src/backends.ts` is the one seam where a
  future Cloudflare backend lands (blocked today by containers#147 — see the spec).

### The `#shared` resolution (one seam, three runtimes)

`package.json` `imports` maps `#shared/*` conditionally: `src` for typecheck
(`types`) and dev (`development`, set by `dev:daemon`), `./dist/shared` at runtime
(`default`) so the built daemon runs in a checkout. Vitest uses its own alias; Vite
inlines it into the browser bundle; the staged `web-app/package.json` points it
straight at `./dist/shared`.

### Data paths that matter

- **Terminal**: binary WS frames, 1-byte opcode. End-to-end flow control — the
  client acks bytes only after xterm renders them; past 128 KB unacked the daemon
  pauses the PTY. The `tests/e2e` flood test fails if this loop breaks. Don't bypass it.
- **Session persistence**: PTYs keyed by id, decoupled from sockets; the headless
  mirror replays a serialized snapshot on reattach, then streams live. Reconnect is
  indefinite (`term/reconnect.ts`, `online`/`visibilitychange` wakes).
- **Concurrent agent sessions**: each `type:"agent"` session spawns its PTY in its
  own git worktree via `session worktree open`; on exit it's **held** for the merge
  gate (the close card surfaces the diff → Merge / Discard), auto-merged only on the
  per-project `autoMerge` opt-in.

### Security model

Localhost is not a security boundary. The daemon binds `127.0.0.1` only (unless
`WEBCODE_HOSTED=1`), enforces a Host-header allowlist (DNS rebinding) + an Origin
allowlist (WS hijacking), and uses token-in-URL → HttpOnly cookie auth (the cookie
is `sha256(token)`, stateless across restarts). **Every filesystem path goes
through `resolveSafe`/`safeJoin` in `src/server/safe-path.ts`.** Never accept a raw
client path into `fs` calls.

## Conventions

- Design tokens: the Tailwind v4 `@theme` block in `src/client/state/index.css`. UI
  primitives live in `src/client/` kit components — compose them.
- Hosted-mode env: `WEBCODE_HOSTED`, `WEBCODE_ROOT`, `WEBCODE_TOKEN`, `WEBCODE_PUBLIC_HOST`, `PORT`.
- The daemon scans up to 20 ports upward from the default if it's busy.
- The hot core (`sessions`/`term-protocol`/`safe-path`) is touched **minimally** — make it
  clearer through comments, never re-derive the flow-control logic.

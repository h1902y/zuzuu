# `@zuzuucodes/web` — the folded workbench (rebuild in progress)

> **Transitional location.** This is the greenfield rebuild of the visual workbench
> as **one folded package** (replacing the `protocol` / `daemon` / `web-ui` workspace
> in `../packages/`). It lives at `web/v2/` only until **Rung 7**, when the old
> `packages/*` are culled and this is promoted up to `web/`. The old tree stays live
> and green throughout (the proven kernel-rebuild method). Plan + rationale:
> [`docs/specs/2026-06-22-workbench-greenfield-rebuild.md`](../../docs/specs/2026-06-22-workbench-greenfield-rebuild.md).

One package, no workspaces. Three source domains + the deferred cloud skin:

```
src/
  shared/   the wire contract — 1-byte WS opcodes, flow-control watermarks, REST DTOs.
            The ONLY thing both halves import (#shared/*). A plain DAG: shared → {server, client}.
  server/   the long-lived daemon — PTY, headless-xterm mirror, 128KB flow control,
            fs/git/ripgrep, per-session worktrees. Proven behavior, ported (174 tests).
  client/   a fresh, lean SPA (Vite + React 19) the daemon serves as static files.
bin/        zz-web entry (port scan, token, singleton, browser open).
tests/      server/ (the ported 174) · client/ (grow back) · e2e/ (PTY round-trip smoke).
```

**The dependency split is deliberate:** runtime `dependencies` are the **daemon** deps
(they become `@zuzuucodes/cli`'s `optionalDependencies`); the **client** ships as
pre-built static assets, so its deps are `devDependencies` (build-time only).

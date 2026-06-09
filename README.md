# webcode

A 100%-native-feeling terminal + file explorer for your local machine, in the browser.

A small daemon runs on your machine; the browser connects to `localhost` and gets a real shell
(real PTY, 24-bit color, mouse, full keyboard) plus a file explorer panel over the workspace —
sessions survive page reloads, output never freezes the tab, and nothing leaves your machine.

```
┌────────────┬──────────────────────────────┐
│ FILES      │ zsh ● │ vim ● │ +            │
│ ▸ src      ├──────────────────────────────┤
│ ▸ docs     │ ❯ npm run dev                │
│   pkg.json │ …a real terminal (xterm.js   │
│            │  + WebGL + PTY over WS)      │
└────────────┴──────────────────────────────┘
```

## Run

```bash
npm install
npm run build          # builds protocol + web UI + daemon
npm run -w webcode start -- ~/code/my-project
# prints: http://127.0.0.1:7770/?token=…  (opens browser automatically)
```

Dev mode (Vite HMR on :5173, daemon on :7770):

```bash
npm run build -w @webcode/protocol   # once
npm run dev:daemon                   # terminal 1 — add: --dev --token dev
npm run dev:web                      # terminal 2
# then open http://localhost:5173/auth?token=dev
```

## Architecture

```
packages/
  protocol/   shared wire types — WS opcodes, flow-control watermarks, fs API schemas
  daemon/     Hono server · @lydell/node-pty sessions · binary WS protocol · fs REST API
  web/        Vite + React · @xterm/xterm v6 (WebGL) · virtualized file tree · zustand
```

- **Terminal path**: binary WebSocket frames (1-byte opcode). End-to-end flow control —
  the client acks bytes actually rendered (`term.write` callbacks); past 128 KB in flight the
  daemon pauses the PTY, so `yes` / giant `cat` backpressure into the kernel instead of
  freezing the tab.
- **Session persistence**: PTYs live in the daemon keyed by session id, decoupled from
  sockets. A headless xterm mirrors output; reattach replays a serialized snapshot
  (screen + 10k scrollback), then streams live.
- **File explorer**: REST for listings/ops/up/downloads (streaming, Range, zip-on-the-fly),
  WebSocket push of fs events — only *expanded* directories are watched (chokidar,
  non-recursive) so fd usage stays bounded.
- **Security** (localhost is not a security boundary): binds 127.0.0.1 only, Host-header
  allowlist (DNS rebinding), Origin allowlist (cross-site WS hijacking), token-in-URL →
  HttpOnly cookie auth, every fs path through one hardened `safePath` choke point
  (lexical + realpath symlink checks, unit-tested).

## Status

v0.1 — terminal (tabs, reattach, flow control, WebGL) + explorer (tree, watch, upload/
download/zip, rename/delete) working end-to-end. Next: ⌘K file jump, PWA manifest
(standalone window frees Cmd+W/T), settings, `npm i -g` packaging, SSH-out.

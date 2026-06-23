---
title: Terminal-over-web benchmark — zuzuu workbench vs the field
date: 2026-06-23
kind: prior-art-audit
method: 8 parallel web-researchers (ttyd · code-server · vscode.dev · Gitpod/Coder · Wetty/GoTTY · sshx/tmate/upterm · xterm.js · tmux/mosh) → high-effort synthesis
---

# Prior-Art Benchmark — zuzuu Workbench: Terminal-over-Web Layer

*Benchmark date: 2026-06-23 · System under test: `web/src/{shared,server,client}` (verified against source) · 8 comparable systems researched*

## Executive Summary

zuzuu's terminal-over-web layer is, on its **core hot path, at or above industry best practice**. Three of its central decisions are genuinely best-in-class:

1. **End-to-end ack-after-render flow control** — the server pauses `node-pty` *at source* on a bytes-in-flight counter that the client only advances *inside* xterm's `write()` callback (128KB high / 16KB low watermarks). This closes the in-flight-buffer gap ttyd leaves open and is a mechanism that GoTTY, Gitpod, Coder, sshx, tmate, and upterm **entirely lack**.
2. **Headless-mirror + `addon-serialize` Replay frame** — the xterm.js-canonical reconnect pattern, identical to VS Code and Gitpod, with the original refinement of excluding the Replay frame from flow accounting.
3. **A layered localhost security stack** — `127.0.0.1` bind + Host allowlist + Origin allowlist + HttpOnly `sha256(token)` cookie + realpath/lstat symlink jail — stronger than any compared local daemon, several of which shipped CVEs in this exact surface.

The field is **clearly ahead in three areas zuzuu has deliberately deferred**, all coherent with a localhost-first, single-operator product stage: **multi-viewer multiplexing / collaboration** (sshx, tmate, upterm fan one PTY to N viewers — zuzuu is strictly single-attachment and *kicks* the prior client), **predictive local echo** for high-latency links (mosh, sshx), and **PTY-host crash isolation + container persistence** (VS Code's PtyHost, Gitpod's supervisor-as-PID-1, Coder's load-tested reconnecting-PTY). None are oversights — but they become real once cloud session waves E–H ship.

## Per-Dimension Comparison

| Dimension | zuzuu's choice | What the field does | Verdict |
|---|---|---|---|
| **Transport & framing** | Binary WS, byte-0 numeric opcode (8 total), raw bytes for I/O + UTF-8 JSON control, no base64, one WS per session | ttyd: same shape, ASCII opcodes, no Ack/Replay. GoTTY: base64 (+33% overhead). Wetty: Socket.IO string events. VS Code/Gitpod/sshx: multiplexed RPC/protobuf. xterm.js maintainer's own prototype = byte-0 opcode+ack | **Ahead** |
| **Flow control / backpressure** | Ack-after-render; pause node-pty at source 128KB↑ / 16KB↓; client acks in xterm `write()` cb, batched 32KB or 50ms; single inflight counter | ttyd/Wetty: real but ttyd leaves WS-buffer gap, Wetty loose (2MB/512KB). VS Code: identical but shared channel, toggleable. GoTTY/Gitpod/Coder/sshx/tmate/upterm: **none**. mosh/tmux: RTT/lag pacing instead | **Ahead** |
| **Persistence, reconnect, replay, multiplexing** | PTY in process map; headless mirror + serialize Replay (excluded from flow); backoff 500ms→15s + instant online/visibilitychange wake; **single-attachment, new client kicks old**; one PTY/session | VS Code/Gitpod: same replay + 3h grace + PtyHost isolation. Coder: UUID reconnecting-PTY at scale. sshx: sequence-number **delta** replay. tmate/sshx/upterm: **N-viewer fanout**. mosh: stateless IP roaming | **Behind** |
| **Security (bind/auth/path/rebind/origin)** | 127.0.0.1 default; Host + Origin allowlist on HTTP **and** WS upgrade; HttpOnly+SameSite=Strict sha256(token) cookie, timing-safe; realpath/lstat jail on every FS path | ttyd: 0.0.0.0, origin-check off, CVE-2021-34182 (unauth RCE). GoTTY: 0.0.0.0, token as JS global. code-server: origin only, no jail. Gitpod: same-site cookie CVE. sshx: relay-blind E2E. mosh/upterm: SSH-grade | **Ahead** |
| **Process & packaging** | One folded npm pkg; #shared contract; Hono+ws+node-pty daemon; Vite/React 19 SPA; zero-dep CLI core, daemon deps optional; **all PTYs in one process** | ttyd: static C binary, embedded HTML. VS Code: respawnable PtyHost. Gitpod: supervisor-as-PID-1, PTY survives restart. Coder: coderd + per-workspace agent. sshx/upterm: folded single binary | **On-par** |
| **Techniques worth stealing** | Already ships the two best-practice techniques; converged on the xterm.js maintainer's own prototype | Unstolen: delta replay (sshx), predictive echo (mosh/sshx), tinybuffer coalescing (Wetty), ms-behind staleness (tmux), event-batching (VS Code), excludeAltBuffer (xterm), read-only/force-command (GoTTY/upterm), snapshot-then-stream queues (tmate) | **Behind** |

## Where zuzuu Matches or Beats Best Practice (validated against source)

- **Ack-after-render flow control is genuinely best-in-class.** Verified: `connection.ts` L99 acks only inside `term.write(payload, () => this.ack(...))`; `sessions.ts` L240–248 pauses the PTY above `FLOW_HIGH_WATER`, L386–393 resumes below `FLOW_LOW_WATER`. ttyd leaves the in-flight WS-buffer gap open; six of eight systems have no PTY-source backpressure at all.
- **Two-watermark design is simpler than and equivalent to the xterm.js-canonical 100K/10K**, and sits well inside xterm.js's 50MB internal-discard ceiling — the exact safety margin the official guide warns about.
- **Replay-frame-excluded-from-flow-accounting** (`opcodes.ts` L29–32, `sessions.ts` L288) is a refinement *not present in any documented prior-art system*, including VS Code and Gitpod which otherwise ship the identical headless-mirror+serialize pattern.
- **The security stack exceeds every compared local daemon.** Verified: `cli.ts` L41/L140 (127.0.0.1 default, warn-on-expose), `auth.ts` `upgradeAllowed` L78–85 (Host+Origin+cookie on WS upgrade), L40/L100–105/L128–132 (sha256 cookie, HttpOnly, SameSite=Strict, timing-safe), `safe-path.ts` `resolveSafe` (realpath/lstat jail). ttyd shipped an unauth-RCE CVE; GoTTY serves its token as an exfiltrable JS global.
- **Independent convergence on the xterm.js maintainer's own unmerged opcode prototype** (commit 898884d: byte-0 opcode, 0=data/1=ack) extended to 8 opcodes — the strongest available external validation of the framing.
- **PTY-decoupled-from-socket process map** is confirmed correct by Coder (UUID reconnecting-PTY, load-tested) and tmux (server-owns-PTY).
- **No base64 on the I/O path** (`frames.ts`) avoids GoTTY's ~33% wire tax and Wetty's Socket.IO polling-fallback overhead.

## Gaps (each grounded in a named system)

| Gap | Severity | Evidence |
|---|---|---|
| **No multi-viewer multiplexing** — single-attachment, a 2nd client kicks the 1st (`sessions.ts` attach L282–284, close 4000). Blocks pair-programming / agent-watch / shared sessions. | med | sshx (Tokio broadcast + per-viewer cursors), tmate (ws_broadcast), upterm (io.MultiWriter) |
| **No predictive local echo** — every keystroke waits a full RTT. Invisible on localhost; degrades sharply once the PTY is remote (waves E–H). | med | mosh (50ms window, underline-until-confirmed), sshx (Mosh-style over WS) |
| **No PTY-host process isolation** — all node-pty + mirrors in the single daemon; a runaway PTY or crash degrades the whole daemon, restart kills all PTYs. | med | VS Code (respawnable PtyHostService), Gitpod (supervisor-as-PID-1 + reaper) |
| **Unbounded reconnect retention** — abandoned tabs pin a PTY+mirror forever; no server-side eviction. | low | VS Code (configurable 3h grace window) |
| **Full-serialize replay every reattach** is heavyweight for a 10k-line scrollback; no delta path. | low | sshx (sequence-number delta replay), xterm.js (`excludeAltBuffer`) |
| **No output coalescing** — one WS frame per PTY read chunk (`sessions.ts` L240–243) under floods. | low | Wetty (tinybuffer 2ms/512KB), VS Code (PTY-boundary event batching) |
| **No read-only session mode** — agent/replay sessions accept input identically; no per-session input gate. | low | GoTTY (PermitWrite=false default), upterm (force-command + authorized-keys) |
| **No transport-layer authenticated encryption for the cloud path** — relies on TLS-to-relay; socket trusts any local process once the port is open. Cloud-only concern. | low | sshx (relay-blind AES), mosh (AES-OCB3), VS Code Remote Tunnels (SSH-inside-WS) |

## Recommendations (ranked by value / effort)

1. **[small] Server-side output coalescing** — a 2ms / 32–64KB tinybuffer between `pty.onData` and the Output frame, *before* the flow gate. Wetty-proven; pure server change, no protocol/client churn. Best value-per-effort win.
2. **[small] Configurable session eviction timer** (1–3h) for sockets-detached sessions, replacing unbounded retention. Keep indefinite *client* reconnect; bound the *server's* willingness to hold an abandoned PTY. VS Code's 3h grace pattern.
3. **[small] `excludeAltBuffer:true` (and optional scrollback cap) on the Replay snapshot** (`sessions.ts` attach L287). One-line xterm.js option; strictly shrinks reconnect cost.
4. **[small] Per-session read-only flag** gating `ClientOp.Input` in `ws-term.ts`. Enables safe replay/observe/agent-watch views. GoTTY/upterm-proven.
5. **[small] Forwarded > X-Forwarded-Host > Host precedence** in the allowlist (`auth.ts`) before any reverse-proxy/hosted deploy. code-server's `ensureOrigin` pattern.
6. **[medium] Design multi-viewer fanout** — socket → Set of sockets, per-viewer inflight counter, per-new-viewer snapshot (tmate's snapshot-then-stream pending/active queue). Defer until pair/observe is a real product need; it is the structural prerequisite for collaboration.
7. **[large] Extract node-pty + mirrors into a respawnable PTY-host child process** (VS Code PtyHostService / Gitpod supervisor). Sequence with cloud wave E (container-per-worktree); unjustified IPC complexity for today's localhost daemon.
8. **[medium] Client-side Mosh-style predictive echo**, gated to high-RTT/hosted sessions only. Self-contained on the client; only pays off once the PTY is remote.

## Sources

- **ttyd** — `tsl0922/ttyd` `src/protocol.c`, `server.h`, `pty.c`; CVE-2021-34182 (#692); tmux-for-persistence (#840); xterm.js flow-control guide.
- **code-server / openvscode-server / VS Code** — `terminalProcess.ts`, `ptyService.ts`; VS Code v1.60 (`@xterm/headless`); FlowControlConstants; issues #74620, #113827; code-server auth/security deepwiki.
- **vscode.dev / WASI / WebContainers** — vscode-web docs; wasm-wasi-core README; StackBlitz WebContainers; Remote Tunnels (SSH-inside-tunnel).
- **Gitpod (Ona) / Coder** — Gitpod `supervisor.go`, `terminal.proto`, `xterm-go`, workspacekit ring0–2; Coder `agentsdk`, reconnectingPTY (PR #15615), Tailscale/DERP networking; Snyk/GitLab Gitpod CVE writeups.
- **Wetty / GoTTY** — `butlerx/wetty` `flowcontrol.ts`, `spawn.ts`; `yudai/gotty` `webtty.go`, `options.go`.
- **sshx / tmate / upterm** — `sshx.proto`, `session.rs`, `encrypt.rs`; tmate `session.ex`, `tmate-msgpack.c`; upterm `server.go`, docs; mosh USENIX ATC 2012 paper.
- **xterm.js ecosystem** — flow-control & security guides; `AttachAddon.ts`, `SerializeAddon.ts`; jerch prototype commit 898884d.
- **tmux + mosh + WezTerm** — tmux Control-Mode wiki, `tmux-protocol.h`; mosh.org + source; WezTerm multiplexer (`compute_changes()` dirty-tracking).
- **zuzuu (verified in-repo)** — `web/src/shared/{opcodes,flow}.ts`, `web/src/server/{sessions,ws-term,frames,auth,safe-path,cli}.ts`, `web/src/client/term/{connection,reconnect}.ts`, `web/CLAUDE.md`.

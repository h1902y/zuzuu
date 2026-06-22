# Workbench greenfield rebuild — platform research & decision record

> **Status:** research / live spec (work **not yet shipped**). Dated **2026-06-22**.
> Records the grounding for rebuilding the visual workbench (`web/`) from scratch as
> one folded package, and for choosing its platform stack. The recommended stack,
> the folded structure, and the rung sequence are appended once the ce design
> workflow completes (see *Open — pending synthesis* at the end).

## Context — why this exists

The 2026-06-22 YAGNI pass on the CLI core (`src/`) surfaced that the **workbench
drifted from v1 and was never reconciled**: the daemon still shells ~a dozen CLI
verbs v2 doesn't have (`checkpoint`, `session inspect|trace|tree|content`, `eval`,
`inbox`, `module items|overview|schema`), staying green only because every route
falls back to reading `.zuzuu/` files — several at now-wrong paths (`sessions.json`
was cut; generations moved to `.generations/<m>/`). The web-ui carries a fully-dead
whole-brain-checkpoint surface.

Rather than patch the drift, the decision is to **rebuild the workbench from scratch
as ONE folded package with a neat, teachable structure**, and to settle the platform
stack at the same time. The user's framing: web-ui possibly on **Next.js** (to host
on **Vercel**); inclined toward a **Tauri** desktop app "if it gives an advantage";
and wants a comparison of going **100% Cloudflare** as the SaaS platform.

This document is the research that grounds that decision. The single most important
finding (below) constrains everything: **the daemon cannot run on any stateless
serverless runtime.**

## The artifact today — three packages

`web/` is a self-contained npm-workspaces monorepo (not a root workspace), shipped
inside `@zuzuucodes/cli` as `web-app/`:

| Package | npm name | LOC | Tests | What |
|---|---|---|---|---|
| `protocol` | `@zuzuu-web/protocol` | 786 | — | binary WS opcodes + flow-control watermarks + REST schemas |
| `daemon` | `@zuzuucodes/web` | 3,302 | 174 | Hono + `ws` + `@lydell/node-pty` + fs + git + chokidar + ripgrep |
| `web-ui` | `@zuzuu-web/web` | 18,100 | 417 | React 19 / Vite / Tailwind v4 / Monaco / xterm |

~22k LOC, 591 tests. The rebuild is "full greenfield — daemon + client + protocol,
one package, from zero" (user's chosen scope).

## The hard constraint — capabilities any host MUST provide

The daemon is a **long-lived, stateful, OS-native process** — fundamentally a local
agent that exposes the user's real shell + filesystem to a browser. A host is viable
only if it provides **all** of:

1. **A persistent, stateful long-running process** surviving across many requests /
   socket reconnects (PTY + in-memory headless-xterm mirror + 10k scrollback +
   flow-control counters live in heap, keyed in a process-local `Map`; sessions are
   decoupled from sockets and reattached indefinitely — there is no externalized
   session store).
2. **Native-addon support (`node-pty`)** — spawn a real interactive PTY (the user's
   login shell or a host-agent CLI argv) with `write`/`resize`/`pause`/`resume`.
   Without a PTY there is no product. (`daemon/src/sessions.ts`)
3. **A real, writable POSIX filesystem with symlink + realpath semantics** —
   `fs-api.ts`, the `safe-path.ts` realpath guard, git worktrees, temp-dir shell
   injection, `~/.webcode/` state.
4. **Arbitrary subprocess spawn of system binaries** — `git`, `rg`/`grep`,
   `lsof`/`readlink`, `open`/`xdg-open`, the bundled `zz` CLI, the user's shell.
5. **OS file-watching** (inotify/FSEvents) with persistent fds (`chokidar`, one
   non-recursive watcher per expanded dir, `ws-fs.ts`).
6. **Raw HTTP-server `upgrade` access for a long-lived WebSocket server** (`ws` on
   `@hono/node-server`) — connections open indefinitely. (`server.ts`)

**What makes the terminal transport custom (the part you can't get off the shelf):**
ttyd-style **binary WS framing** (1 opcode byte + payload — `Input/Resize/Ack` up,
`Output/Exit/Replay/Title/Cwd` down) plus an **end-to-end flow-control loop**
(`FLOW_HIGH_WATER=128 KiB`, `LOW_WATER=16 KiB`, `ACK_INTERVAL=32 KiB`): the client
acks bytes only after xterm renders them, and the daemon pauses/resumes the *native
PTY* on those acks. This is what keeps `yes`/a giant `cat` from freezing the tab.
(`protocol/src/index.ts`, `daemon/src/frames.ts`, `daemon/src/sessions.ts`)

### Verdict: incompatible with stateless serverless (Vercel functions / CF Workers)

A request-scoped function cannot hold a live child process, an in-memory terminal
mirror across reconnects, chokidar fds, or the flow-control loop; it can't spawn a
PTY or the host agent CLIs; it has no real workspace filesystem. **The daemon is
architecturally either a local desktop process (today's default) or a per-user
container/VM (the existing `WEBCODE_HOSTED=1` path).** Serverless can host the static
SPA + a thin control plane — never the daemon.

## How it runs today

**One daemon, two run modes (env-gated by `WEBCODE_HOSTED`); the code path is
otherwise identical.**

**Local (the shipped product):** `zz web` (`src/cli/web.mjs`) resolves the bundled
daemon, spawns it detached with `--zuzuu-bin <abs path>`. The daemon binds
`127.0.0.1` only (**refuses any non-loopback bind unless `WEBCODE_HOSTED=1`**),
scans up from port 7770. Auth (`auth.ts`): token-in-URL → HttpOnly `webcode_auth`
cookie = `sha256(token)` (stateless, survives restarts), + a **Host-header
allowlist** (DNS-rebinding defense) + **Origin allowlist** (WS-hijack/CSRF). A
**singleton-per-workspace** instance file (`~/.webcode/instances/<id>.json`) lets
`zz web` reuse a live daemon (same port + token, old tabs keep working).

**Cloud (`web/hosted/`, design-complete, Fly-targeted — not the shipped product):**
- `hosted/sandbox/` = the VM image (`Dockerfile` builds protocol+web+daemon, drops
  to a non-root user, seeds `~/workspace`) + `fly.toml` (`auto_stop_machines`,
  `min_machines_running=0`).
- `hosted/broker/` = the control plane (Hono): `POST /api/sessions` enforces per-IP +
  global caps → mints a per-session token → `backend.create(token)` → returns the VM
  URL; a 30s-TTL reaper tears down idle VMs.
- **`backends.ts` is the one seam** — a `Backend` interface with `create(token)` /
  `destroy(id)`. Today: `local` (child process, no Docker) and `fly` (one Firecracker
  Machine per session via `api.machines.dev`, `auto_destroy:true`). **The VM is the
  isolation boundary** for untrusted public users.

**Packaging:** build pipeline protocol (tsc) → web-ui (Vite) → daemon (tsc + copy the
Vite output to `daemon/web-dist`, served statically). `web/scripts/build-web.mjs`
stages `daemon/dist` + `web-dist` into repo-root `web-app/` (git-ignored), deps
stripped. The daemon's runtime deps are the **root CLI's `optionalDependencies`** —
`dependencies` stays empty (the zero-dep guarantee); a failed `node-pty` build
degrades the workbench, never the CLI. There is **no** published `@zuzuucodes/web`.

**Root-CLI integration (the "mutations always go through the CLI" invariant):**
`daemon/src/zuzuu-cli.ts` is the only place the daemon shells `zz` — `runZuzuu`
(reads; failure → `null`, degrade to file reads) and `runZuzuuMut` (mutations + CLI
reads; distinguishes `absent` 503 vs `failed` 502). Every brain write goes through
`runZuzuuMut`; the daemon never imports `src/loop/`. **The daemon can live anywhere
that can spawn `zz` in the workspace.**

## Platform analysis (against the hard constraint)

### Vercel / Next.js — UI layer only
The SPA ports to Next.js trivially (it's already Zustand + TanStack Query + Monaco +
xterm; protocol + REST schemas + opcodes stay). **But the entire daemon cannot move
to Vercel functions.** Net: Vercel replaces the SPA-serving + launch-page role for
the cost of a **split origin** (the token→cookie + Host/Origin auth needs cross-origin
rework), and the daemon still has to run on Fly/a container elsewhere. A thin win,
genuinely useful **only** for the marketing site + `zuzuu.codes` dashboard (already
intended Vercel-native), not the workbench runtime.

### 100% Cloudflare — the clean SaaS fit
Maps onto the existing two-tier shape **better than Vercel**, because Cloudflare now
has the stateful primitives the daemon needs:
- **Broker → a Worker + Durable Object.** The broker is already a small Hono app with
  an in-memory session registry + per-IP/global caps + a TTL reaper. A **Durable
  Object** is the right home for the registry + reaper (DO **alarms** for TTL); the
  Worker serves the launch page + `POST/DELETE /api/sessions`. Hono runs on Workers
  unchanged; IP extraction becomes `cf-connecting-ip`; Turnstile is native.
- **Per-user daemon → Cloudflare Containers / the Sandbox SDK** (GA 2026, with real
  **PTY support**, filesystem watching, snapshot-based session recovery — purpose-built
  for "run untrusted code + PTY + preview URLs per session"). The daemon's
  `WEBCODE_HOSTED=1` path already binds `0.0.0.0` from env and bundles the CLI via the
  Dockerfile — it ports as-is. **The `backends.ts` `Backend` interface is the single
  seam**: a third `cloudflare` backend beside `local`/`fly`.
- **Alignment:** the root project already fixed "Evolution engine runtime = Cloudflare
  Workflows only." A 100%-CF workbench puts the broker (Worker+DO), the per-user daemon
  (Container/Sandbox), and the evolution engine (Workflows) on **one platform** — the
  cleanest consolidation. (DO WS billing is 20:1 on inbound messages; Container active-
  CPU pricing + scale-to-zero suit intermittent use — confirm in the cost model.)

### Tauri — the local-first play
A single installable desktop app folds daemon + UI into one artifact, killing the
localhost/port/token dance and the browser-security model. PTY via Rust `portable-pty`
(the path mature Tauri-2 terminal/VS-Code clones took) **or** shipping the existing
Node daemon as a Tauri **sidecar binary** (keeps `node-pty` + the proven daemon, less
rewrite). Costs: code-signing/notarization + auto-update + cross-platform packaging/CI;
and Next.js-SSR doesn't fit a webview (a static export or Vite is the natural client).

## Emerging recommendation (to be confirmed by the workflow synthesis)

A **hybrid**, because the local and cloud runtimes have genuinely different shapes:
- **Local-first:** Tauri desktop app (or keep the local Node daemon) — the daemon runs
  on the user's machine.
- **Cloud SaaS tier:** **100% Cloudflare** — Worker + Durable Object broker, Cloudflare
  Containers/Sandbox per-user daemon; consolidates with the CF-Workflows decision.
- **Next.js / Vercel:** reserved for **marketing + the `zuzuu.codes` dashboard**, not
  the workbench runtime.
- A **single shared TypeScript client** targets both local and cloud daemons over the
  same protocol.

This honors "enhance, never reinvent" (the proven realtime core — PTY flow-control,
reconnect, mirror — is ported cleanly, not re-suffered) while giving a clean
single-package fold and a credible SaaS path.

## Open — pending synthesis (ce ideate → strategy → plan workflow)

A fanned-out design workflow (run 2026-06-22) is pressure-testing five candidate
stacks through architecture / feasibility / product lenses. When it returns, append:
- **Recommended stack** (with the explicit verdict on Next.js, Tauri, 100% CF).
- **The folded single-package directory structure** (server + client + shared).
- **The rung-by-rung rebuild sequence** (greenfield-beside-old, swap at the end — the
  proven kernel-rebuild method), incl. what to port cleanly vs rewrite, and where the
  591 existing tests map.
- **Top risks + open decisions** the user must make.

### Key files (for whoever executes)
- Runtime core: `web/packages/daemon/src/{sessions.ts,server.ts,frames.ts,ws-term.ts,ws-fs.ts,fs-api.ts,safe-path.ts,git.ts,search.ts}`
- Protocol: `web/packages/protocol/src/index.ts`
- Cloud seam: `web/hosted/broker/src/backends.ts` (the `Backend` interface) · `web/hosted/sandbox/{Dockerfile,fly.toml}`
- CLI integration: `web/packages/daemon/src/zuzuu-cli.ts` (the invariant) · `web/packages/daemon/src/zuzuu-routes.ts`
- Packaging: `web/scripts/build-web.mjs` · `src/cli/web.mjs` · root `optionalDependencies`

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

## Synthesis — recommended approach (ce ideate → strategy → plan, 2026-06-22)

A fanned-out design workflow (13 agents: ideate 5 stacks → ce-web-researcher platform
deep-dives → architecture/feasibility/product lenses → ce-plan) returned a clear,
unanimous winner. **It revises the "full greenfield from zero" framing — and revises
the emerging hybrid above.**

### Recommendation: keep the daemon, rebuild the SPA, fold to one package, defer the platform bets

**Candidate 1 won every lens (9 / 8.5 / 9).** The move is *not* a from-zero rewrite of
everything — it is: **port the daemon + protocol essentially verbatim, rebuild only the
client SPA fresh, collapse the three packages into one, and make the cloud/desktop/Vercel
choices independent, deferrable, reversible adapters decided later.**

Why: the four non-negotiables (real PTY, local fs/git/ripgrep, the long-lived stateful
process with the headless-xterm mirror + 128 KB flow control + indefinite reconnect, the
custom 1-byte binary WS, per-session worktrees) are **already met by the daemon that
exists today** and pinned by **174 tests**. Rewriting that code adds pure risk for zero
value and violates "enhance, never reinvent." **All the genuine risk is in the SPA — which
is rebuilt under every option anyway.** You buy a clean structure for the price of the
rebuild you were already paying, and add zero new platform risk. The fold is mechanical:
the three packages are held apart only by `@zuzuu-web/protocol` being a published workspace
package the daemon imports runtime values from (forcing the `vendor-protocol` hack +
3-step build, confirmed `scripts/build-web.mjs:27`). Collapse it into `src/shared/` imported
relatively and that seam, the vendor script, and the `@zuzuu-web/*` indirection all vanish.

### The three platform bets — explicit verdicts

- **Next.js / Vercel — disqualified for the workbench; ideal for `zuzuu.codes` as a
  SEPARATE project.** Vercel Functions can't be a WS server and can't run `node-pty`
  (unanimous across Vercel docs / Ably / Rivet); Fluid Compute doesn't change it. The
  workbench panes (xterm/Monaco/zustand) are 100% client-side with zero SSR/RSC need, so
  Next buys nothing inside a locally-served SPA and costs App-Router/Turbopack friction for
  the Monaco/xterm web workers. **Keep Vite.** Build the Vercel dashboard whenever, as its
  own thing — Candidate 1 grants that free (the daemon only serves static files).
- **Tauri — a later, optional desktop *skin*, not a rebuild prerequisite.** Real upside
  (native installer, folder picker, deep links, signed auto-update, no port/token friction)
  but mis-targeted today (users already live in a terminal) and it hits **two confirmed
  blockers**: the open macOS `externalBin` notarization bug (tauri#11992, Dec 2024) and the
  fact that **Node SEA/pkg cannot fold a native `.node` addon into one binary** — so "ship
  the daemon verbatim as a sidecar" is false; it's a per-arch multi-file prebuild. The
  "clean" Rust `portable-pty` path means rewriting the safety-critical `sessions.ts` flow
  engine in Rust and discarding the 174 tests. **Validate desktop demand first;** because
  Candidate 1 makes the daemon a localhost WS server, a Tauri webview drops in later with
  the UI untouched — deferring costs nothing.
- **100% Cloudflare — the eventual SaaS substrate, but blocked today; keep Fly interim.**
  Elegant on paper (Worker = control plane, DO-per-workspace = broker, Container = daemon
  image, drop Fly; rhymes with the fixed CF-Workflows bet) but a **disqualifying open bug
  for this exact workload**: cloudflare/containers **#147** — active WebSocket traffic does
  *not* renew the `sleepAfter` timer, so an idle-but-connected PTY session is **killed
  mid-session**, no fix/timeline. Plus ephemeral disk wiping worktrees on sleep (needs
  DO-driven R2 backup/restore — new safety-critical surface), 1–3 s cold starts, and the DO
  Hibernation API not fitting a binary pass-through socket. **Stay on Fly (`hosted/` already
  is) until #147 closes; re-evaluate Q3 2026.** The cloud host is a reversible adapter (same
  daemon binary in Fly or a Container) — do not couple it to this rebuild.

This *refines* the "emerging hybrid" above: the end-state (Vercel = dashboard, Tauri =
later, CF = eventual) is right, but the **rebuild itself commits to none of them** — it is
just fold + SPA-rebuild + keep-daemon, on Fly for cloud until CF unblocks.

### The folded single-package structure

One package `@zuzuucodes/web`, **no `workspaces`**. Three source domains — **server /
client / shared** — plus the unchanged cloud skin; two build outputs (`dist/server`,
`dist/web`), the daemon serves the latter.

```
web/
  package.json            # ONE package; deps merged from the 3 children; NO "workspaces"
  tsconfig.json           # one project; paths: { "#shared/*": ["./src/shared/*"] }
  vite.config.ts          # src/client → dist/web
  bin/zz-web.js           # CLI entry (was daemon/src/index.ts): port scan, token, singleton, WEBCODE_HOSTED gate
  src/
    shared/               # ← protocol (786 LOC). PLAIN internal module: opcodes · flow · schemas · index
                          #     imported by BOTH halves via #shared/* → kills vendor-protocol + 3-step build
    server/               # ← daemon (3.3k LOC). PORTED ~VERBATIM.
      server.ts · sessions.ts[DO NOT TOUCH] · ws-term.ts[DO NOT TOUCH] · ws-fs.ts · fs-api.ts
      safe-path.ts[DO NOT TOUCH] · git.ts · search.ts · cast.ts · worktree.ts · zuzuu-cli.ts
      shell-integration/ · static.ts (serves ../web) · index.ts (createDaemon(opts) factory)
    client/               # ← web-ui (18.6k LOC). REBUILT FRESH on Vite/React 19.
      main.tsx · app/ · term/ · explorer/ · editor/ · panel/ · palette/ · state/
      lib/{api.ts, connection.ts(WS framing + ack/flow-control, imports #shared)}
    index.html
  cloud/                  # ← hosted/ UNCHANGED (the deferred SaaS skin): broker/(Fly) · sandbox/(Dockerfile+fly.toml)
  tests/
    server/               # ← the 174 daemon specs, moved, imports rewritten to #shared
    client/               # ← rebuilt UI specs (the 417 grow back as the SPA grows)
    e2e/                  # smoke: spawn daemon, WS, PTY round-trip, flow-control
  scripts/build-web.mjs   # simplified: tsc(server)+vite(client)→dist/{server,web}, stage ../web-app/ (~half its length)
```

Teachable invariant: **`shared/` is the only thing both halves import; the binary frame
protocol is the universal seam; nothing in the hot PTY/flow-control path forks** — a plain
DAG (`shared → server`, `shared → client`, no edge back), mirroring the kernel's discipline.

### Rung-based rebuild sequence (greenfield-beside-old, swap at the end)

On a `rebuild/workbench` branch; the old `packages/*` stay live until Rung 7. Each rung
ships green.

- **Rung 0 — scaffold the fold** (single `package.json`, `#shared/*` alias, empty
  `src/{shared,server,client}`). *Test:* install resolves, `tsc --noEmit` passes.
- **Rung 1 — absorb protocol → `src/shared/`** (PORT clean; delete `@zuzuu-web/protocol` +
  vendor step). *Test:* `tsc` on shared.
- **Rung 2 — port the daemon verbatim → `src/server/`** (PORT clean; only edits: imports
  `@zuzuu-web/protocol`→`#shared`, extract `worktree.ts`/`static.ts`, `createDaemon()`
  factory). **Move the 174 tests → `tests/server/`; green only when all 174 pass — that's
  the proof the engine survived.** Golden ids stay pasted-from-real-run.
- **Rung 3 — daemon serves a placeholder SPA** (wire `static.ts`; one page that echoes a
  PTY round-trip). *Test:* `node bin/zz-web.js ~/repo` (never the PATH binary), `yes | head`
  doesn't freeze the tab (flow control lives); E2E smoke added.
- **Rung 4 — rebuild client core: term + explorer** (REWRITE fresh; `connection.ts` reuses
  the proven ack/flow loop against the unchanged `#shared` protocol). Tests grow back in
  `tests/client/`.
- **Rung 5 — rebuild editor + right panel + palette** (Monaco, the five-ModuleTile
  dashboard, cmdk, recordings last). *Test:* parity checklist vs old SPA, screenshot-verified.
- **Rung 6 — simplify `build-web.mjs`** (tsc(server)+vite(client)→dist; no npm-ci-of-3, no
  protocol vendoring). *Test:* `web-app/` stages + the published-shape CLI launches it.
- **Rung 7 — cull** `packages/{protocol,daemon,web}` + the root `workspaces` block. *Test:*
  full suite green; no `@zuzuu-web/*` references remain.

**PORT verbatim:** `shared/` (protocol), the entire `server/` daemon, `cloud/` (Fly
broker+sandbox), and the **174 server tests**. **REWRITE fresh:** the entire `client/` SPA
(18.6k LOC) + its tests (the 417 grow back; they don't map 1:1 onto rebuilt components).

### Candidate comparison (all effort L)

| # | Stack | Risk | Verdict |
|---|---|---|---|
| **1** | **Keep daemon · rebuild SPA · fold to 1 pkg · defer platform** | **low** | **WINNER (9/8.5/9)** |
| 2 | Tauri desktop (Node daemon as sidecar) | medium | later optional skin; blockers #11992 + SEA-native-addon |
| 3 | Next.js on Vercel + local/cloud daemon | medium | Vercel can't host daemon; Next buys nothing for the SPA |
| 4 | 100% Cloudflare (Worker+DO+Containers) | medium | eventual SaaS; blocked by containers#147 today |
| 5 | Hybrid (local-first + 100% CF cloud) | medium | the eventual end-state, but don't bundle it into the rebuild |

### Top risks

1. **The SPA rebuild is the whole budget + the only feature-regression risk** — keep the
   old SPA shippable until Rung 7 for A/B parity.
2. **Rung-2 import-only edits could perturb the timing-sensitive flow control** — Rung 2 is
   logic-frozen, gated on all 174 tests + the `yes | head` E2E; verify with `node
   bin/zz-web.js`, never the PATH binary.
3. **Don't let "host on Vercel" creep into the workbench** — the Vercel dashboard is a
   separate project; the client stays Vite.
4. **Deferred cloud surface is real** — when CF is chosen, ephemeral-disk worktree loss
   (#147 + wipe) needs R2 backup/restore on a DO alarm; stay on Fly until #147 closes.

### Open decisions for you

- **Client framework:** confirm **Vite** (recommended) vs Next static-export.
- **Scope:** adopt **Candidate 1** (keep daemon, rebuild SPA) vs the literal full-from-zero
  daemon rewrite you'd selected — the research argues strongly for Candidate 1.
- **Desktop:** defer **Tauri** (recommended) vs commit now.
- **Vercel dashboard timing:** after the local rebuild ships (recommended), as its own repo.
- **Cloud host:** keep **Fly** interim (recommended); revisit 100% CF in Q3 2026 — and if so,
  verbatim-daemon Container (variant A, preserves invariants) vs Sandbox SDK (variant B).

### Key files (for whoever executes)
- Runtime core: `web/packages/daemon/src/{sessions.ts,server.ts,frames.ts,ws-term.ts,ws-fs.ts,fs-api.ts,safe-path.ts,git.ts,search.ts}`
- Protocol: `web/packages/protocol/src/index.ts`
- Cloud seam: `web/hosted/broker/src/backends.ts` (the `Backend` interface) · `web/hosted/sandbox/{Dockerfile,fly.toml}`
- CLI integration: `web/packages/daemon/src/zuzuu-cli.ts` (the invariant) · `web/packages/daemon/src/zuzuu-routes.ts`
- Packaging: `web/scripts/build-web.mjs` · `src/cli/web.mjs` · root `optionalDependencies`

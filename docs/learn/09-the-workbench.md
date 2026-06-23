# 09 · The workbench — one folded package

> Lessons `02`–`08` were the brain: the envelope, the verbs, the loop, the gate,
> the CLI. This page is the **visual surface** — the browser workbench at `web/`.
> It's a different kind of program (a long-lived realtime daemon + a React SPA),
> and it carries its own lesson: **how to rebuild from scratch without re-suffering
> the hard parts.**

The code is `web/src/{shared,server,client}`. The rationale + the rung-by-rung plan
are in [`docs/specs/2026-06-22-workbench-greenfield-rebuild.md`](../specs/2026-06-22-workbench-greenfield-rebuild.md).

## What it is

A daemon runs on `127.0.0.1`; your browser connects and gets a **real PTY shell**
(your actual `$SHELL` or a host agent CLI), a file tree, a Monaco editor, git, and
the modules dashboard. `zz web` launches it. It is, deliberately, **not** a custom
chat loop — it's a real terminal with the brain alongside.

That one requirement — a *real* shell over the network — is the whole architecture.
A real PTY is a long-lived OS process with stdin/stdout; you cannot serve it from a
stateless function. So the workbench is a **stateful local daemon**, and everything
follows from keeping that daemon honest.

## One package, three domains

The workbench used to be three npm packages (a `protocol`, the `daemon`, the
`web-ui`) in a workspace, held apart only so a separately-published protocol could be
shared. The 2026-06-22 rebuild folded them into **one package**, `src/` split by who
runs the code:

```
src/
  shared/   the wire contract — both halves import it, nothing else
  server/   the daemon — runs in Node, owns the PTY and the filesystem
  client/   the SPA — runs in the browser, draws the terminal
```

It's a plain DAG, the same discipline as the kernel (lesson `reading-the-code`):
`shared → server`, `shared → client`, **no edge back**. `shared/` is the one seam,
imported as `#shared/*`. Collapsing the published package into a plain internal
module deleted a whole class of friction at once — no vendor-copy step, no version
skew between what the client sends and what the server expects.

## The binary terminal, and the one trick that matters

The terminal socket doesn't speak JSON. It speaks **1-byte-opcode binary frames**
(`shared/opcodes.ts`): one byte says *what* (`Input`, `Output`, `Resize`, …), the
rest is the payload — raw bytes for I/O, JSON only for control. Cheap, and it never
confuses a megabyte of `cat` output with a control message.

The hard part is **flow control**, and it's worth understanding because it's the one
place a naive terminal falls over. Run `yes` and the PTY emits megabytes a second.
If the daemon just forwards every byte, the browser's render queue backs up and the
tab freezes. So (`shared/flow.ts` + `server/sessions.ts` + `client/term/connection.ts`):

1. The daemon counts bytes **sent but not yet acknowledged**.
2. The browser sends an `Ack` only **after xterm has actually rendered** the bytes.
3. Above 128 KB unacked, the daemon **pauses the PTY**; the acks drain it; below
   16 KB it **resumes**.

Backpressure that's *real* — measured against the renderer, not guessed. The
`tests/e2e` flood test floods past 128 KB and asserts it all arrives: if the
ack→pause→resume loop ever breaks, that test hangs. It's the canary for the whole
engine.

> Going deeper on the OS-level mechanics — what a PTY actually *is*, why escape
> sequences force binary framing, the watermark hysteresis, and the headless-mirror
> replay — is its own companion page: [The terminal, mechanically](the-terminal-mechanically.md).

A second subtlety: a PTY **outlives its socket**. The daemon keeps a server-side
*headless mirror* of the terminal (a real xterm running with no display) so when you
reload the page, it replays the serialized screen + scrollback, then streams live.
Sessions survive reloads, laptop sleeps, and long blips (the client reconnects
indefinitely). The PTY is keyed by id in a process-local map; the socket is just a
pipe that comes and goes.

## Why the daemon was *ported*, not rewritten

Here's the lesson in restraint. The rebuild's real goal was the same as the kernel's:
**cut the bloat, make it educative.** The obvious move is "rewrite everything from
scratch." For the SPA — 18,100 lines of React — that was exactly right: it was
rebuilt fresh and came back at **1,693 lines** for the same core. ~91% was bloat.

But the daemon's hot core (`sessions.ts`, `ws-term.ts`, `safe-path.ts`) encodes
*hard-won, non-obvious edge cases* — the flow-control watermarks, the mirror replay,
the symlink jail. Rewriting that from memory re-discovers every one of those bugs the
hard way. So it was **ported**: the logic frozen, the imports rewritten to `#shared`,
the dead routes pruned, and the existing **tests carried over as the proof** the
engine survived the fold. The principle: *the proven engine is the asset; the tests
are the contract; you cut bloat where it's safe (the SPA) and you don't re-suffer the
realtime bugs where it isn't (the engine).*

## The build, and `#shared` in three runtimes

`npm run build` is one `tsc` (server + shared → `dist`) + one `vite` (client →
`dist/web`), staged into `../web-app/` for the published CLI. The old version ran
`npm ci` across three packages and a "vendor-protocol" copy-and-rewrite shim — both
gone with the fold.

The one wrinkle worth naming: `#shared` must resolve to **TS source** during
typecheck and dev, but to **built JS** when the daemon runs from `dist`. The
`package.json` `imports` field does this with conditions (`types`/`development` →
`src`, `default` → `dist/shared`); vitest uses its own alias; the staged `web-app`
points straight at its built `dist/shared`. One declaration, every runtime correct.

## Security, briefly

Localhost is not a trust boundary, so the daemon defends the *edges*: it binds
`127.0.0.1` only, enforces a Host-header allowlist (DNS rebinding) and an Origin
allowlist (cross-site WS hijacking), and exchanges a URL token for an HttpOnly cookie
(`sha256(token)`, so it survives daemon restarts). And **every filesystem path goes
through `safe-path.ts`** — lexical resolve + per-segment realpath/lstat — so a crafted
`../` or a symlink can't escape the served workspace. That file is in the
touch-it-minimally set for a reason.

## The cloud seam (not built)

`web/cloud/` is the deferred SaaS skin: a broker that provisions a per-user daemon
(today via Fly Machines) and the container image. The daemon is the *same binary*,
gated by one env flag — so the cloud tier is the engine *placed* elsewhere, not a
second codebase. The `Backend` interface (`cloud/broker/src/backends.ts`) is the one
seam a future Cloudflare backend slots into. Why not Cloudflare today? The spec has
the honest answer (an open Containers bug kills idle-but-connected PTY sessions).

---

**Where this leaves the project:** the brain (lessons `02`–`08`) and the workbench
(this page) are one repo, one CLI (`zz`), one folded web package — the visible
surface over the same envelopes the brain manages, every mutation still flowing
through the human gate.

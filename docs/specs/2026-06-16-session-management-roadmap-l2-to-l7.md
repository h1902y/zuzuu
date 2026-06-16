# Session Management Roadmap — Level 2 → Level 7 (+ Fly.io local↔cloud sync)

**Status:** live spec for review (unshipped). **Date:** 2026-06-16.
**Scope:** how zuzuu gets from today's session management to fully *portable* sessions, including the Fly.io directory-sync bridge that unblocks "local project dir, cloud compute." Research synthesis + a sequenced wave plan. We review this, then build it with rigorous TDD (characterization-first on anything touching the session-git / PTY hot path).

---

## 1. Where we are today

Built and shipped: a server-side PTY pipeline (xterm.js + WebGL over a binary WebSocket, end-to-end flow control, a headless server-side xterm mirror, reattach-replays-scrollback), `.cast`/asciicast recording, git-native sessions (`zz/session-*` branch + turn-checkpoints + squash-merge), host-agnostic capture/trace, the session tabs/picker/tree/composer, search, rename, attention, the diff wedge, and a daemon that runs its own bundled CLI. Hosted mode already targets **Fly Machines**.

**On the session-management maturity ladder, zuzuu sits at Level 2, partially 4/5.**

| Level | Capability | zuzuu today |
|---|---|---|
| 1 | Raw PTY (dies on disconnect) | — |
| 2 | **Persistent session** (server-side daemon; detach/reattach) | ✅ |
| 3 | **Resilient transport** (survives laptop sleep / IP change / server-or-VM migration) | ✗ — biggest gap |
| 4 | **Named, grouped, layout-restorable** sessions | ~ (session index + git assoc; no layout snapshot/manifest) |
| 5 | **Replayable + seekable** | ~ (`.cast` recorded, not seekable) |
| 6 | **Shareable** (collaborative, permissioned) | ✗ |
| 7 | **Portable** (moves across machines / into the cloud / browser) | ✗ |

---

## 2. Research findings (build vs reuse)

### Verdict: BUILD on our infra; reuse a small set of MIT components; study patterns.

**Nothing is embeddable.** Every parallel-agent / session tool is a *standalone app*, not a library, and the most complete are **AGPL** — a hard blocker for the `@zuzuucodes/cli` package.

| Project | Stack | License | Reuse verdict |
|---|---|---|---|
| Claude Squad (smtg-ai) | Go TUI | AGPL-3.0 | Study pause/resume (commit+remove worktree); **AGPL — no link** |
| Vibe Kanban (BloopAI) | Rust+TS | Apache-2.0 | Study full lifecycle (worktree→PTY stream→PR/merge) |
| ccmanager (kbwo) | TS/Bun TUI | MIT | **Closest stack** — study the TS worktree state machine |
| uzi / Crystal / Sculptor / Conductor | Go / Electron / Py / Mac | mixed / closed | Study only |
| container-use (Dagger) | Go + MCP | Apache-2.0 | The worktree+container *hybrid* pattern reference |

**The git primitive is thin:** `git worktree add/remove` + `merge --squash`. We already own the hard parts (PTY flow control, capture, session-git).

### Reusable, license-clean components (daemon/web layer — the zero-dep CLI core stays untouched)
- `@xterm/headless` + `@xterm/addon-serialize` (MIT) — "state, not bytes" reconnection (we already run a headless mirror).
- `simple-git` (MIT) or plain `execFile('git', …)` — worktree lifecycle.
- asciicast v2/v3 (open spec) — already our `.cast`; v3 adds markers/relative timing.
- `@devcontainers/cli` (MIT, shell-exec) + `devcontainer.json` (CC-BY) — workspace definition, when we add containers/cloud.
- `dockerode` (Apache-2.0) / Dagger SDK — container isolation, when needed.
- **Fly Machines API** — cloud substrate (already our hosted mode); `suspended` (Firecracker snapshot, ~100s of ms) vs `stopped` lifecycle.

### Patterns to steal (not code)
- **Eternal Terminal** `BackedReader/BackedWriter` — sequence-numbered output buffer; reconnect replays only the delta (terminal output as a write-ahead log). Apache-2.0 pattern.
- **Mosh / sshx** — predictive local echo; session keyed by crypto id (roaming).
- **asciinema ALiS** — an `Init` message carrying the serialized framebuffer for zero-gap late-join (I-frame); 60s grace window.
- **Zellij / tmux-resurrect** — human-readable session manifest (pane tree + commands).
- **Coder / code-server** — `--reconnection-grace-time` (server-side session TTL independent of the client); activity-bumped idle deadlines; prebuild pool.
- **upterm / sshx** — `--read-only` + force-command for shared/observer links; E2E + presence.
- **DevPod (MIT)** — provider abstraction (one workspace def, runs local Docker *or* a cloud VM) — the model for local↔Fly.

### Avoid (license or lock-in)
Daytona / Coder server / code-server server (AGPL); Ona/Gitpod (OpenAI-acquired June 2026 — wind-down risk); Devin / Cursor SDK / Factory / Claude Code SDK (closed or single-agent — break host-agnosticism).

---

## 3. What Level 7 (portable) actually requires

"Portable" = a session can be **moved across machines, lifted into the cloud, and brought back**, with its work, context, and replay intact. That needs five pieces — most of which lower levels build:

1. **A portable session manifest** (Wave C) — the durable definition of a session: branch/commit, workspace definition ref (`devcontainer.json`), pane/layout, host + initial task + context-digest pointer, and the capture/trace pointer. Content-addressed (extend our generation/checkpoint model from faculties to sessions).
2. **A durable object store** — git object store (already) + trace + serialized framebuffer snapshots, content-hashed, dedup, pointer-flip restore (we already have this shape via generations).
3. **A reproducible workspace definition** — `devcontainers` so the environment rebuilds identically on any machine/cloud.
4. **Resilient transport** (Wave A) — so a session survives the move (sequence-delta reconnect + grace window).
5. **The working-dir bridge** (Wave F, Fly sync) — so the project files are present cloud-side without manual upload.

**(Stretch) browser-native runtime** — WebContainers (Node-only, proprietary) / `container2wasm` (Apache-2.0, slow) — a research spike, not a near-term dependency.

---

## 4. The Fly.io local↔cloud sync bridge (the portability enabler)

**Use case:** the developer keeps their project directory **on their local machine** (source of truth, their editor, their files) but the **agents run in the cloud** (Fly Machine — more compute, runs while the laptop sleeps), with changes synced both ways. This removes the "upload/manage my repo in the cloud" friction and is the on-ramp to portable sessions.

**Approaches (to decide in review):**
1. **Live file-sync engine** — Mutagen (dev-focused two-way sync; what Docker Desktop uses) or Syncthing (continuous P2P), local dir ↔ Fly Machine volume, transported over Fly's native **WireGuard mesh**. Live, file-granular. *Recommended for the active-session mirror.*
2. **Git-native sync** — push the session branch to a cloud remote, run there, pull back. Aligns with our git model but is commit-granular (coarse for live editing). *Recommended as the reconciliation/merge layer (we already do this).*
3. **DevPod/Tailscale-style** provider + `devcontainer.json` in the Machine — heavier, but gives reproducible envs.

**Recommendation:** git-native for reconciliation (already true) **+** a live file-sync engine (Mutagen/Syncthing) for the working-dir mirror during an active cloud session, over the WireGuard mesh, with Fly Machines `suspend/resume` for idle. This is **Wave F**; it directly precedes L7.

---

## 5. The build sequence (waves)

Ordered for dependency + risk. Each wave: rigorous TDD; **characterization-first** for anything touching session-git or the PTY hot path; pure-logic extracted and unit-tested first; the flow-controlled binary PTY path is never modified destructively.

| Wave | Goal (ladder) | Core work | Reuse / pattern | Risk |
|---|---|---|---|---|
| **A — Resilience** | L2→L3 | Server keeps the PTY alive + a sequence-numbered ring buffer; reconnect sends last seq → replay delta; serialized-framebuffer snapshot on (re)attach; server-side grace window before a session dies | `@xterm/serialize` (MIT) + ET delta pattern + code-server grace-time | Med (touches reconnect path; additive, not the flow-control core) |
| **B — Concurrency** | (Wave-3) | `git worktree add` per session (own dir+branch); daemon runs N agent PTYs; lift single-active-agent; Agent panel (all live agents, status, jump, cancel); merge/cleanup/prune | git worktrees (native) + study ccmanager/Claude Squad | **High** — session-git is safety-critical → characterization-first |
| **C — Session manifest** | L4 | A portable, git-tracked session manifest (JSON: layout, branch/commit, workspace-def ref, host+task+context pointer, capture pointer); restore-from-manifest; content-addressed via the generation model | Zellij/tmux-resurrect manifest shape | Med |
| **D — Seekable replay** | L5 | Periodic framebuffer "I-frame" snapshots as `m` markers in the existing `.cast`; O(1) seek; workbench scrubber | asciicast `m` markers (open spec) | Low (additive) |
| **E — Runtime isolation (hybrid)** | (enables cloud) | Optional container-per-worktree (ports/DB/deps isolation) via `devcontainer.json`; for agents that run servers/tests/migrations | `dockerode`/Dagger + devcontainers (MIT) | Med |
| **F — Fly local↔cloud sync** | (bridge to L7) | Mutagen/Syncthing dir mirror over Fly WireGuard mesh; Fly Machines provision + suspend/resume; git-native reconciliation | Fly Machines API + Mutagen/Syncthing + DevPod model | **High** (new infra surface) |
| **G — Portable sessions** | L7 | Move a session across machines / to cloud and back using the manifest (C) + object store + workspace def (E) + sync (F) + resilient transport (A); (stretch) browser-native runtime spike | container2wasm / WebContainers (spike) | High |
| **H — Sharing/collab** | L6 | Observer/collab session links (`--read-only` + force-command), presence, a relay; slots after F (needs a relay) or earlier as local-only share | upterm/sshx patterns | Med |

### Recommended order
**A → B → C → D → E → F → G**, with **H** slotted after F. Rationale: **A first always** (resilient transport de-risks every later move and benefits all sessions today); **B** delivers the headline concurrency; **C** creates the portability *unit*; **D** is a cheap additive win; **E+F** stand up cloud; **G** composes them into true portability; **H** (sharing) rides the relay that F/cloud introduces.

---

## 6. Cross-cutting guardrails (every wave)
- **Never** destructively modify the flow-controlled binary PTY hot path (`term/connection.ts`, `ws-term.ts`, flow control). Additive seams only.
- **session-git is the most safety-critical module** — characterization tests pin current behavior *before* any change (the single-working-branch invariant test already exists).
- **CLI core stays zero-dep**; new deps live in the daemon/web layer (optionalDependencies).
- **License hygiene** — no AGPL linkage; study-only for AGPL/closed projects.
- **Host-agnostic + observe model** — we wrap agents, never become one; no single-vendor lock-in.
- **Fail-soft** — git/PTY/sync failures degrade, never crash the session view.

---

## 7. Open decisions for review
1. **Worktrees-only vs hybrid containers** for B — start worktrees-only (covers file-editing agents), add E (containers) when runtime isolation is needed? (Recommended.)
2. **Fly sync engine** — Mutagen vs Syncthing vs git-only for the live mirror (F).
3. **Adopt `devcontainers`** as the workspace-definition standard (C/E/F), or a lighter zuzuu-native def?
4. **Sharing transport** (H) — self-hosted upterm-style relay vs sshx-style E2E mesh; when (after F, or a local-only earlier cut)?
5. **L7 browser-native runtime** — worth a spike (container2wasm/WebContainers) or defer indefinitely?
6. **Sequencing** — confirm A-first, or prioritize B (concurrency) since it's the headline ask?

---

## 8. Next step
Review this document (decisions in §7), then begin **Wave A (resilience)** — or whichever wave we agree to lead with — under rigorous TDD, characterization-first.

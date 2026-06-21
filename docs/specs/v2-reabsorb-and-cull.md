# Spec: v2 reabsorb → the clean cull (rung 8)

> **Status:** design-stage, not built. The plan to retire the v1 substrate **without regressing shipped features** — by first rebuilding the surfaces v1 still owns on the v2 kernel, then deleting v1 in one safe pass. Supersedes the earlier "rung 8 = delete v1" note (written before the dependency map below existed).

## Why a blind cull is unsafe

The v2 rebuild (rungs 1–7) replaced v1's **data model and verbs** — and is **self-contained** (verified: zero imports from v1). But it did **not** replace v1's **product surface**, which still sits on the v1 core:

| live v1 surface | depends on v1 core | shipped? |
|---|---|---|
| session mgmt — git branch/worktree/manifest (ladder A–D) | `core/store · core/session · sessions/` | ✅ v1.7.0, in `main` |
| live capture + hooks (Design B) | `live/ · core/capture-core · capture/` | ✅ |
| `enable`/`disable`, `doctor` | `live/ · home/ · knowledge/ · sessions/` | ✅ |
| `code`/`web` launchers | `core/ · home/` (web: none) | ✅ |

Deleting v1 now would drop all of it (≈81 test files of behavior). So: **reabsorb first, cull last.** The workbench (`web/`) is a separate package (`zuzuu-web-workspace`) with no `zuzuu/` source imports — unaffected by the cull either way.

## The disposition of every v1 area

Three fates: **DROP** (v2's design makes it unnecessary), **REABSORB** (rebuild on the v2 kernel), **KEEP-then-delete-with-v1** (a duplicate v2 already replaced).

### DROP — the OTLP/trace observability layer (~1.7k lines, the biggest single win)
`capture/core/{otlp,spans,render,event,ids}` · `capture/adapters/*` (the OTLP-emitting parse) · `core/capture-core` · `commands/{capture,trace}`.

v1 parsed transcripts into **OTLP trace blobs** (`.traces/`) for observability. v2's observe (`hosts/ + pipelines/observe`) mines transcripts **directly into proposals** — it never needed traces. The mining signals were already harvested into `hosts/adapters/claude-code.mjs` (rung 6). So this whole layer is **deleted, not ported**. (The per-session *record* in `sessions.json` is separate — that's session mgmt, reabsorbed below.)

### REABSORB — rebuild on the v2 kernel
- **session index + lifecycle** (`core/store` session half, `core/session`) → into `kernel/store.mjs` (the v2 store already owns addressing; add the `sessions.json` index + the `opening→active→completed|abandoned` state machine).
- **session git substrate** (`sessions/{git,session-git,session-worktree,session-manifest,labels}`, ≈862 lines) → a v2 `sessions/` over the new index. *Most of it is already v1-core-free* — `session-git`/`git` import nothing from core; only `manifest`/`labels` touch `core/store`, which becomes `kernel/store`. Largely a re-point, not a rewrite. **Safety-critical → characterization-first** (its existing invariants: single-working-branch, secret-exclusion on checkpoint, fail-soft-never-throw).
- **live + hooks + enable** (`live/install`, `commands/{hook,enable}`) → a v2 `hook` (lifecycle → trigger `observe` + write the digest + drive a session checkpoint; `PreToolUse` → run **v2's `capabilities/gate`**) + `enable`/`disable` (install the v2 hook block by `SIGNATURE`, never clobbering user hooks).
- **doctor / status / explain** (`commands/{doctor,status,explain}`) → v2 verbs: health + **crash reconciliation over v2 sessions**, the host/session inventory, porcelain transparency.
- **launchers** (`commands/{code,web}`) → thin re-wire to v2 `init`/`enable`. `web` has no v1-core deps (move as-is); `code` configures+launches the OpenCode binary (rewire its config seam to v2).
- **migrate** — NEW: upgrade an existing v1 home (`module.json` faces) → v2 (`module.md` envelopes), so installed `.zuzuu/` dirs survive the cut.

### KEEP-then-delete — the v1 verb duplicates (deleted *with* v1 in the final pass)
`commands/{init,knowledge,review,proposals,distill,digest,act,module,checkpoint,eval,inbox}` + `module/ modules/ knowledge/ memory/ actions/ instructions/ home/ digest/ eval/` — all replaced by v2's `capabilities/ + cli/ + pipelines/`. They stay running (via `bin/zuzuu.mjs`) until the final pass so nothing breaks mid-migration.

## The rung sequence

| rung | delivers | risk | notes |
|---|---|---|---|
| **8a** | session index + lifecycle in `kernel/store` | low | foundation; pure addition to v2 |
| **8b** | `sessions/` on v2 + `zz session [status·worktree·manifest·restore]` | **high** | safety-critical; characterization-first; mostly a re-point |
| **8c** | v2 `hook` + `enable`/`disable` + live install; `PreToolUse` → v2 gate | med | Design B preserved (hook signals, never builds spans) |
| **8d** | v2 `doctor`·`status`·`explain`·`code`·`web` | low | thin; `web` moves as-is |
| **8e** | `migrate` (v1→v2 home) · repoint `bin` → v2 router · **DELETE v1** · drop the OTLP layer | med | one pass; full v2 suite green; verify the slimmed tree |

After 8e: one parser, one CLI, one capture path. The OTLP/trace layer is gone; the data model is the envelope; `bin/zuzuu.mjs` is the v2 router. Target ≈4–5k lines of product code (down from ≈13k), session mgmt + live capture + enablement intact, rebuilt clean.

## Verification discipline (unchanged from rungs 1–7)
Each rung: build on v2 → tests (hermetic + a real-data playground where a host is involved) → its `docs/learn` lesson → commit. 8b re-characterizes the existing session-git invariant tests before porting (never deletes them). 8e is gated on every reabsorbed surface having a green v2 equivalent — the cull only runs when its replacement is proven. **No silent feature loss:** if a v1 behavior is intentionally not carried over, it's recorded in `LOG.md`, not dropped quietly.

## Open calls (decide before 8b)
- **Session index format** — keep `sessions.json` (tracked, git-linked) as-is, or fold into the envelope model (a `type: session` zu)? Leaning: keep `sessions.json` (it's an index, not knowledge; the envelope is for the brain, not runtime bookkeeping).
- **`code` (OpenCode host)** — reabsorb now, or defer until the OpenCode-bundle stage is revisited? Leaning: thin-rewire now (cheap) so the cull is total.

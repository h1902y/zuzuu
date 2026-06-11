# Spec — `mns code`: the OpenCode bundle (Stage 2)

**Date:** 2026-06-11
**Status:** approved design → implementation plan
**Stage:** Stage 2 of the three-stage product sequence (① host-agnostic wrapper ✅ → **② OpenCode as the default bundled host (`mns code`)** → ③ owned harness on pi). DESIGN §6.

## Goal

One command — `mns code` — drops a newcomer who runs *no* coding agent into a fully faculty-equipped OpenCode session: faculty home scaffolded, OpenCode installed if missing, the mns plugin (capture + gate) enabled, the digest grounding served, and an interactive OpenCode launched in the project. **We configure + launch the real OpenCode binary; we never fork it, never reimplement it, and never drive it headlessly** (the observe model; interactive-first canon).

## Decisions (locked in brainstorming)

- **Bundling = detect + install-on-demand.** OpenCode is a runtime peer, never an npm dependency — mns's hard **zero-runtime-dep policy** stands (`package.json` `dependencies: {}`). "Bundled" means *the default host you get*, fetched once on first use, not a node_modules entry.
- **Scope = full one-step launcher** (init → ensure-opencode → enable → launch). Not a minimal launcher, not an onboarding/auth wizard.
- **Model = passthrough**, no baked default. `--model M` forwards to OpenCode; otherwise OpenCode's own config decides. (The efficiency-model choice belongs to the Stage-2/3 benchmark, not the launcher.)

## Command surface

```
mns code [dir] [--model M] [--yes] [-- <opencode args…>]
```
- `dir` (optional, default `process.cwd()`) — the project to work in (becomes OpenCode's cwd).
- `--model M` — forwarded to OpenCode as `-m M`.
- `--yes` / `-y` — non-interactive: auto-confirm the OpenCode install prompt (for scripts/CI).
- `-- …` — everything after `--` is passed through to `opencode` verbatim.

## Flow (the orchestration)

1. **Resolve dir** — `dir = args._[0] ? resolve(args._[0]) : process.cwd()`. If it doesn't exist → error + exit 1.
2. **Ensure the faculty home** — if no `.mns/` under the dir's repo root, run the existing `init` against that dir (scaffold + AGENTS.md block — OpenCode reads `AGENTS.md`, so steering + the digest pointer are served). If `.mns/` exists, leave it (idempotent; init is no-op-safe but we only call it when absent to keep output clean).
3. **Ensure OpenCode** (`ensureOpencode({ yes })`):
   - Detect: `spawnSync('opencode', ['--version'])` → installed if exit 0.
   - If missing: print *"OpenCode isn't installed."* Then, unless `--yes`, prompt `Install it now? (npm i -g opencode-ai) [Y/n]`. On **yes** → `spawnSync('npm', ['install', '-g', 'opencode-ai'], { stdio: 'inherit' })`; re-detect. On **no** or install failure → print the manual command (`npm i -g opencode-ai`) and exit 1.
4. **Ensure the plugin** — call `enable({ host: 'opencode' })` for the dir (idempotent: writes `.opencode/plugins/mns.js` = capture + gate; the plugin's `session.created` fires `writeLiveDigest` so `.mns/live/digest.md` grounds the session). **Fail-open:** if `enable` throws, warn and continue to launch (the agent still works, just unwired) — never block the launch.
5. **Launch** — `spawn('opencode', [...(model ? ['-m', model] : []), ...passthrough], { cwd: dir, stdio: 'inherit' })`. Hand the terminal to OpenCode. On exit, `mns code` exits with the same code. We do not pipe, parse, or steer the session — capture + gate happen via the already-installed plugin.

## Components

| File | Responsibility | Action |
|---|---|---|
| `mns/commands/code.mjs` | `code(args, deps)` orchestrator + `ensureOpencode()` helper | **Create** |
| `bin/mns.mjs` | `case 'code': code(args); break;` + a help line | **Modify** |
| `tests/unit/code.test.mjs` | orchestration + ensureOpencode, no real TUI | **Create** |

### Testability seam (critical — the launch is an interactive TUI)
`code(args, deps = {})` accepts an injected `deps` object: `{ detect, install, launch, runInit, runEnable, prompt }` defaulting to the real implementations. Tests pass fakes to assert the orchestration **without spawning OpenCode or npm**:
- `detect()` → boolean (opencode present?).
- `install()` → boolean (success?).
- `launch({ cwd, model, passthrough })` → exit code.
- `runInit(dir)` / `runEnable(dir)` → record calls.
- `prompt(question)` → 'y'/'n' (the install confirm).
The real `code(args)` wires these to `spawnSync`/`spawn`/`init`/`enable`/a readline prompt.

## Error handling (all fail-loud-or-open as appropriate)

- **dir missing** → error + exit 1 (loud — user typo).
- **opencode missing + declined/failed install** → manual command + exit 1 (loud — can't launch without it).
- **enable throws** → warn, continue to launch (open — degrade, don't block).
- **launch fails / opencode errors** → propagate opencode's exit code.
- Never throw an unhandled error; never leave the terminal in a bad state.

## Testing

- **Unit (`tests/unit/code.test.mjs`)** with injected `deps`:
  - no `.mns/` → `runInit` called; existing `.mns/` → not called.
  - opencode present → no install, `runEnable` + `launch` called with the resolved cwd.
  - opencode missing + `prompt→y` + `install→true` → re-detect → launch; `prompt→n` → exit 1, no launch.
  - `--yes` skips the prompt and installs directly.
  - `--model M` → `launch` receives `model:'M'`; `-- foo` → `passthrough:['foo']`.
  - `enable` throwing → still launches (fail-open), warning emitted.
- **Dogfood (self-served up to the spawn):** `mns code <tmpdir>` with opencode present → confirm it scaffolds `.mns/`, writes `.opencode/plugins/mns.js`, and invokes the launcher with cwd=tmpdir (use the injectable launcher to assert without taking over the terminal). The actual interactive TUI launch is verified by a real `mns code` run (opencode opens pre-wired).

## Explicitly NOT in scope (YAGNI)

- Model/provider **auth or onboarding wizard** (OpenCode owns its auth; v1 assumes a configured provider or surfaces OpenCode's own auth prompts).
- A **baked efficient-model default** (passthrough only; the efficiency benchmark is separate).
- **Bundling OpenCode as an npm dependency** (zero-dep policy).
- Driving OpenCode headlessly / `mns code -p` (interactive-first; headless capture already exists via `mns capture`).
- Any change to the OpenCode plugin itself (capture + gate are done, exp-12).

## Verification

`mns code` in a fresh dir launches a pre-wired OpenCode: `.mns/` scaffolded, `.opencode/plugins/mns.js` present, AGENTS.md carries the faculty block, and once a session runs, `.mns/live/digest.md` + a captured trace + (on a gated tool) a guardrails decision appear — i.e. the full faculty stack reaches a newcomer in one command.

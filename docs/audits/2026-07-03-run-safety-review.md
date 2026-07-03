---
type: audit
title: Adversarial moderation review — RUN SAFETY FLOOR (§I rung 3)
date: 2026-07-03
range: 1dc7bf8^..98f9bbe
head: 98f9bbece40a78ee9e4277d6f7f371bc1ca31289
branch: feat/personal-app-roadmap
reviewer: Claude Fable 5 (adversarial moderation)
verdict: ship-after-fixes
---

# Run safety floor — adversarial review

Scope: the 5-commit series `1dc7bf8..98f9bbe` (timeout · fail-closed gate · secret
redaction · per-note run lock · docs). This is the gate every §I workflow-ladder rung
climbs through, reviewed for fail-closed correctness, actor integrity, timeout kill
semantics, redaction leakage, the root-mode secrets path, and test rigor.

**Verdict: SHIP-AFTER-FIXES.** The four safety mechanisms are correctly built and
operator behaviour is byte-preserved. Two SHOULD-FIX issues matter before the agent /
durable rungs (4, tier-2) build on this floor — one silently disables value-based
redaction on the *actual* root-mode vault; one lets the run lock be stolen mid-rollback
(the exact double-run it exists to prevent). No BLOCKER: nothing agent-controllable can
flip the trust posture, and the operator path is unchanged.

## What holds (verified against code + tests)

- **Fail-closed inversion is correct.** For `actor:'agent'`, all three uncertain
  outcomes deny before spawn: malformed rule (`gate.mjs:193`), engine-error catch
  (`gate.mjs:204`), and `ask` verdict (`gate.mjs:197`). `runGated` only proceeds when
  the verdict is not `deny` and only spawns after the allowlist check. Traced every
  `gate()` return path — no null/exception/unknown-verdict path reaches `spawnSync`
  with an agent actor except an **explicit `allow`** or **no-match (null)**, and
  no-match-proceeds is the intended denylist semantics (the guardrail layer is a
  denylist; explicit-allow lives in the `run.allow` allowlist, not the rules). See
  finding NIT-1 for the caveat that this posture has no live caller yet.
- **Operator behaviour byte-unchanged.** `strict=false` → `evaluate()` returned as-is,
  catch returns `null`, `ask` passes through, malformed rules skipped. `loadRules`
  still returns the same rules array (delegates to `loadRulesDetailed().rules`). The
  `malformed` flag is only consulted under `strict`. Confirmed by the operator legs of
  `gate-actor.test.mjs`.
- **Actor is not spoofable.** `ctx.actor` is a threaded function argument stamped at the
  entry boundary (`api.open({actor})` default `operator`; `dispatch.invoke` passes it
  into the handler ctx; hook stamps `'agent'`). It is **never** read from note
  frontmatter or from `inputs` — inputs only ever become `ZZ_*` env vars. A poisoned
  note or input cannot set or flip the actor.
- **Workflow threads actor to every step AND compensation.** `workflow.mjs:74` (each
  step) and `:80` (each compensation) both pass `actor`. No defaulted/missing-actor
  hole in the step loop.
- **Redaction is log-only; the child env is real.** `runGated` builds `env` from raw
  `inputs` before any redaction (`act.mjs:84-85`); redaction happens only inside
  `logRun` on a copy (`log.mjs:100`). Proven end-to-end by
  `run-redaction.test.mjs` ("the child process sees the REAL secret value; only
  runs.jsonl is redacted").
- **The `run:` command string never enters runs.jsonl.** `logRun`'s event carries
  `note` (id) + redacted `inputs` + outcome only — no command, no stdout/stderr. A
  secret in the command or echoed to stdout cannot leak via `logRun`.
- **Timeout is server-agnostic + SIGKILL.** The bound is applied in the `spawnSync`
  call itself (`act.mjs:89`, `timeout: ms, killSignal:'SIGKILL'`), clamped to
  `MAX_TIMEOUT_S=600` by `resolveTimeoutMs` for *every* run — no dependence on any
  server, no note can opt out (`resolveTimeoutMs` clamps down, never up).

## Findings

### SHOULD-FIX 1 — root-mode secrets path silently disables value-based redaction · `src/notes/log.mjs:63`

`readSecretValues` reads `join(home, 'secrets.env')`. The secrets doctrine (§I.1.3, and
`log.mjs`'s own docstring line 39/55) says secrets live in **`.zuzuu/secrets.env`**
(gitignored). In **classic mode** `home == <root>/.zuzuu`, so `<home>/secrets.env`
coincides with the doctrine and the tests pass. But on a **root-mode vault**
`home == root` (`store.mjs:62-64`), so `<home>/secrets.env` resolves to
`<root>/secrets.env` — a *different, un-gitignored* location, not `.zuzuu/secrets.env`
(which in root-mode is `ephemeraDir(root)`). On the actual root-mode deployment,
`readSecretValues` reads a nonexistent file → `[]` → **trigger (2) of `redactInputs`
(value match under an innocuous key) redacts nothing.** Only the `SECRET_KEY_RE` name
heuristic still fires, so a secret passed as e.g. `inputs.note_body = <raw token>` lands
in runs.jsonl in the clear. The redaction tests all use classic-mode homes
(`home = join(root, '.zuzuu')`) so none exercise root-mode — the bug is real and
untested.
*Fix sketch:* read from `join(ephemeraDir(root), 'secrets.env')` (coincides with `home`
in classic mode, resolves to `.zuzuu/` in both) instead of `join(home, 'secrets.env')`;
add a root-mode redaction test.

### SHOULD-FIX 2 — workflow lock staleness omits compensation time → stealable mid-rollback · `src/use/workflow.mjs:61`

`staleAfterMs = Σ(step timeouts) + LOCK_GRACE_MS`. The lock mtime is set once at
`mkdirSync` and never heartbeated. On failure the runner then executes **compensations**
(`:80`) which are gated with **no timeout override** → each defaults to
`DEFAULT_TIMEOUT_S` (120s), and this compensation budget is **not** included in
`staleAfterMs`. A workflow that fails late after several completed steps can therefore
run (steps + rollback) longer than `staleAfterMs` while still holding the lock — a
concurrent second invocation computes `age > staleAfterMs` and **steals the live lock,
producing the exact concurrent double-run the lock exists to prevent**, during the most
fragile moment (rollback of side effects). Converse tradeoff: because there is no
heartbeat, a workflow that crashes *early* still pins the note for the full worst-case
`Σ(step timeouts)` before a legit retry can proceed (availability / mild livelock).
Probability is bounded (needs steps running near their full timeouts + a concurrent
arrival + slow compensations), but it is a correctness gap in the feature's core
invariant. `act()`'s single-note lock is **not** affected — its run is spawn-timeout-
bounded below its own `staleAfterMs`, so no early steal.
*Fix sketch:* include compensation timeouts in the budget (e.g.
`+ Σ(DEFAULT_TIMEOUT_S for compensable steps)`), or heartbeat the lock dir's mtime once
per step so `age` tracks real progress.

### NIT 1 — the agent fail-closed posture has no live caller (dead code today) · `src/serve/api.mjs` / `src/hosts/hook.mjs:88`

No production entry point stamps `actor:'agent'` into `act`/`flow`. The CLI verbs go
through `open(cwd)` → default `operator` (`data.mjs:140,359`); the web server shells the
CLI (operator); the hook stamps `'agent'` only for `registry.touch()`, not runs; and the
PreToolUse `gateDecision` (`hook.mjs:43`) passes **no** actor → operator/fail-open. So
the entire fail-closed inversion is currently exercised only by unit tests, never by a
real run. This is *consistent* with rung 3 being a documented PREREQUISITE built ahead of
rung 4 (triggers) / tier-2 durable runs, where a daemon/trigger runner would call
`open(cwd,{actor:'agent'}).flow(...)`. Flagging so it is a conscious choice: "the gate
everything climbs through" has, today, nothing climbing through it as `agent`. Add a real
agent-actor caller + an end-to-end test when the runner lands so the posture is proven in
production, not just in isolation.

### NIT 2 — SIGKILL kills only the direct child; grandchildren can orphan · `src/use/act.mjs:89`

`spawnSync`'s `timeout`/`killSignal` signals only the direct child. A `run:` that
backgrounds work or spawns its own subprocesses (`bash -c '... &'`, a wrapper that
double-forks) leaves those grandchildren alive after the timeout kill — `spawnSync` has
no `detached`/process-group option, so there is no group kill. For a "safety floor" this
is a real boundary the docs claim closed ("a hung child of the child must actually die").
*Fix sketch:* document it as an honest boundary, or move to a `detached` spawn + kill the
negative PID (process group) on timeout.

### NIT 3 — redactInputs is top-level only · `src/notes/log.mjs:48`

`redactInputs` iterates only top-level `Object.entries(inputs)`; a secret nested at
`inputs.config.token` is not matched (key `config`, value stringifies to
`[object Object]`). Currently harmless because the run machinery flattens inputs to
`ZZ_<k>=String(v)` (`act.mjs:85`), so nested inputs are already unusable by the child and
inputs are always flat scalars in practice. Note it so that if typed/structured inputs
(§I.4 "typed step ports") ever land, redaction is revisited alongside them.

### NIT 4 — lock steal is non-atomic (rm + mkdir) · `src/use/run-lock.mjs:55-63`

The steal path is `rmSync(lock)` then `mkdirSync(lock)` — not atomic. Two invocations
that both observe the same stale lock can both `rmSync`/`mkdirSync` and both believe they
hold it (A's `rmSync` can even delete a fresh lock C created between A's stat and A's rm).
Rare (needs a crashed holder + two simultaneous retries) and inherent to advisory
mkdir-locking, which the module explicitly documents. Acceptable as-is; noted for
completeness.

### Observation — runs.jsonl `actor` is now accurate (not a defect)

Pre-change, `act`/`workflow` called `logRun` without an actor, so runs logged the
hardcoded default `'agent'`. They now pass the real actor (`operator` for CLI). This is a
provenance *improvement* the runs-miner (rung 2) will depend on, but it does change the
`actor` value written for existing CLI runs — worth knowing when reading historical vs
new runs.jsonl.

## Test assessment (question 6)

The 26 tests exercise the DENY paths, not just happy paths:
- `gate-actor.test.mjs` proves malformed→deny, `ask`→deny, engine-error→deny for the
  agent (and unchanged null/ask for operator) at `gate()` level, and that an
  `act`/`workflow` agent run is denied by an ask-rule an operator would pass — `denied:true`
  implies the pre-spawn gate branch fired (no spawn).
- `run-redaction.test.mjs` includes the exact child-env-real / log-redacted proof, plus
  key-shaped and value-match redaction, and non-mutation.
- `run-timeout.test.mjs` / `run-lock.test.mjs` cover real kills, clamp bounds, refuse,
  stale-steal, XDG placement, and the saga-compensation-on-timeout path.

Coverage gaps (minor): the **act/flow-level** malformed-rule and engine-error deny paths
are only tested at `gate()` level, not end-to-end through `act`/`runWorkflow` (only the
`ask` path is tested at that level); no test covers the **root-mode** secrets path
(SHOULD-FIX 1) or the **compensation-window** lock steal (SHOULD-FIX 2). Adding those two
would have caught both SHOULD-FIX issues.

## Bottom line

Ship after SHOULD-FIX 1 and 2. The timeout, redaction (log-only), fail-closed inversion,
and lock mechanics are correct and the operator contract is preserved; the two fixes
close a silent-redaction hole on the real deployment and a mid-rollback double-run window
before anything unattended is allowed to stand on this floor.

## Fixed

Both SHOULD-FIX findings are resolved, CLI-side (`src/`, `tests/`) only:

- **SHOULD-FIX 1** (root-mode secrets path, `src/notes/log.mjs:63`) — `e946439`
  (`§G.2/§G.3/§G.4: rollback wired honestly, the plain-file link, Settings polish`).
  Added `ephemeraDirFromHome(home)` to `src/notes/store.mjs` — reuses the same root
  `project.md` marker sniff `homeDir` uses to tell classic mode (`home` already IS
  `.zuzuu`) from root-mode (`home` IS the repo root, so ephemera is `<home>/.zuzuu`) —
  and pointed `readSecretValues` through it, so secrets now resolve to the SAME
  physical `.zuzuu/secrets.env` in both modes. Regression tests added to
  `tests/unit/run-redaction.test.mjs`: a root-mode `readSecretValues` path test (with
  a decoy at the old, buggy `<root>/secrets.env` location proven unread), plus
  `logRun`- and `act()`-level end-to-end tests proving a secret riding under an
  innocuous input key is redacted in a root-mode log. Note: this fix landed bundled
  into a concurrent commit from a parallel session working the same branch on
  unrelated `web/` changes — the `src/`/`tests/` diff within `e946439` is exactly this
  fix, untouched otherwise.
- **SHOULD-FIX 2** (workflow lock staleness omits compensation budget,
  `src/use/workflow.mjs:61`) — `6754593`
  (`fix(safety-floor): SF2 — budget compensation time in workflow lock staleness`).
  Factored the staleness computation into an exported `workflowStaleAfterMs(steps)`:
  Σ(step timeouts) + Σ(one default compensation timeout per step carrying a
  `compensate`) + grace — matching the compensation loop's actual behavior (it calls
  `runGated` with no per-step timeout override, so each compensation runs at
  `resolveTimeoutMs()`'s default, not the step's own `timeout:`). Tests added: three
  unit tests on `workflowStaleAfterMs` (`tests/unit/workflow.test.mjs`) and one
  integration test (`tests/unit/run-lock.test.mjs`) proving the lock survives a
  worst-case failure-then-full-rollback and is still correctly stolen once genuinely
  past the (now correct) window — verified to fail against the pre-fix formula.

NIT 3 (`redactInputs` is top-level only) got the suggested one-line doc comment in
`src/notes/log.mjs`. NIT 1, NIT 2, and NIT 4 are left as documented, accepted
boundaries — no code changes. No live agent caller was wired (rung 4, deferred).

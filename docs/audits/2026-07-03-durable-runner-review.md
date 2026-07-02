---
type: audit
title: Adversarial moderation review — TIER-2 DURABLE RUNNER (§I rung D, the keystone)
date: 2026-07-03
range: 1000eff^..f3ecaf2
head: f3ecaf22c256cb78a13548c698b5caf5341a1eb2
branch: feat/personal-app-roadmap
reviewer: Claude Fable 5 (adversarial moderation)
verdict: ship-after-fixes
---

# Tier-2 durable runner — adversarial review

Scope: the 4-commit series `1000eff..f3ecaf2` — "the run is a note" (§I.3/§I.4). A
`type: workflow` note becomes a `type: run` state machine in frontmatter, ticked one
step per `advanceRun` through the same gated/timed/locked `act()` path Tier 0/1 use,
persisted through the one write door. Reviewed for the bugs that only surface in
production: crash mid-tick, two ticks racing, a workflow edited under a running
instance, the actor/write-door moat, and the saga on failure. Files read in full:
`src/grow/run.mjs`, `src/cli/verbs/run.mjs`, `src/notes/generation.mjs`,
`src/notes/validate.mjs`, `src/use/workflow.mjs`, plus the rung-A substrate
(`src/grow/commit.mjs`, `src/grow/edit.mjs`, `src/grow/evolve.mjs`,
`src/use/act.mjs`, `src/use/run-lock.mjs`, `src/notes/log.mjs`) and both test suites.

**Verdict: SHIP-AFTER-FIXES.** The headline invariant — generation pinning — is
correct and genuinely honest: `advanceRun` re-reads the def via `noteAsOf` on every
tick, which reads the exact git bytes as-of the pinned generation's commit; a live
(even uncommitted) edit never leaks into an in-flight run; rollback is forward-motion
so the pinned commit always survives. The moat holds end to end (`start`/`advance`/
`signal`/`complete` are all operator-only and `agentInvokable:false`; steps execute as
operator; there is no path by which an agent reaches the runner). At-least-once +
single-end-write is correctly implemented; the idempotency key is deterministic and so
crash-stable; the saga/irreversible/`completed_order` logic is correct and persisted.
48/48 tests green.

One SHOULD-FIX must land before the daemon/trigger rung (§I rung 4) builds on this
floor: the run-note lock's staleness window under-budgets a `note:`-to-workflow tick,
so a concurrent advance can steal the lock and corrupt the durable state / fire a
spurious saga. It is the exact stateful analogue of the composition audit's S1 — and
Tier-2's persisted state makes the stolen-lock window *damaging* where Tier-0's
statelessness made it harmless. No BLOCKER: nothing agent-controllable flips the trust
posture, and the single-driver (manual `zz run advance`, sequential `--all`) path — the
only driver that exists today — is correct.

## What holds (verified against code + tests)

- **Generation pinning is honest (concern 1).** `noteAsOf` (`generation.mjs:101`)
  resolves the gen→commit via `commitForN` and reads `git show <commit>:<path>` — it
  NEVER falls back to the working tree or the live note. A missing gen or a
  note-absent-at-that-gen both return `{ok:false}` (`:104`, `:107`), which `tick`
  propagates as a hard error rather than silently reading current. A direct file edit
  that is not committed is invisible to `git show`, so the pin holds against uncommitted
  edits too. Rollback mints a *new* generation restoring old bytes (forward motion,
  `commit.rollback`) and never deletes the pinned commit, so `workflow_generation`
  stays resolvable after a rollback. `advanceRun` calls `noteAsOf` FRESH each tick
  (`run.mjs:348`), never relying on a start-time snapshot. Covered by the mint-and-edit
  test (`run.test.mjs:315`) and the byte-exactness test (`:339`).
- **The moat / actor path is closed (concern 5).** `startRun` (`run.mjs:179`),
  `advanceRun` (`:431`), and `resolveWait` (`:468`) all refuse a non-operator up front;
  all four CLI rows are `agentInvokable:false` (`cli/verbs/run.mjs`). Steps execute with
  the advance caller's actor (always operator), threaded into `runGated`/`act`. Every
  run-note write is `evolve → commit`, which itself refuses a non-operator. There is no
  agent-started-run-executed-as-operator escalation because an agent can neither start
  nor advance a run. Run-note writes are minted through the one door.
- **At-least-once is correct and the key is crash-stable (concern 2).** A tick executes
  then writes ONCE at the end; a death after spawn / before write leaves the step
  `pending` → re-run next tick. The `idempotency_key` is `` `${runId}:${stepId}` ``
  (`run.mjs:374`) — deterministic, so a re-derivation after a torn write yields the
  identical key. `run-note LOCK exists` (`:433`): two concurrent `advanceRun` on one run
  → the second gets `{running:true}`; the lock is held across execute+write, so no
  concurrent tick double-spawns on the single-driver path.
- **Wait/signal is validated, not blind (concern 3).** `resolveWait` requires
  `run.status === 'waiting'` AND matches a step that is itself `status:'waiting'` on the
  right signal (`run.mjs:493`) / step id (`:499`) — a stray or wrong-named signal is
  refused (`no waiting step matches`), a pending/done step can't be completed. Lazy
  timeout correctly fails the step + run + saga on the next advance (`tick`, `:336`).
- **Saga is correct and persisted (concern 4).** `completed_order` is written on every
  successful tick and every wait-resolution (`:394`,`:480`), so ordering survives
  crashes. `runSaga` (`:257`) walks it in reverse, compensates only `done` steps (the
  failed step is never in `completed_order`), and STOPS at the first `irreversible`
  step, recording how far it got — leaving a coherent partial-rollback + `failed` state.
- **The validate.mjs generalization does not weaken anything (concern 6).** The change
  is scoped to `note.type === 'workflow'` and enforces `[hasRun,hasNote,hasWait].filter
  (Boolean).length !== 1` — genuine exactly-one, not at-least-one (`validate.mjs:98`).
  No other type's validation changes; the only behavioral delta is that a `wait`-only
  step now validates (intended). Confirmed by the neither/both refusal test.

## SHOULD-FIX

**S1 · The run-note lock under-budgets a `note:`-to-workflow tick → a stolen lock
corrupts durable state and fires a spurious saga.** `run.mjs:433` —
`acquireRunLock(home, RUNS_MODULE, runId, MAX_TIMEOUT_S*1000 + LOCK_GRACE_MS)` is a
FIXED 10.5-minute window. But a `note:` step whose target is a multi-step nested
workflow runs Tier-0 `runWorkflow` (`runNoteRefStep`, `:246`), whose own runtime is
`Σ steps` (each ≤ MAX_TIMEOUT_S, up to `MAX_COMPOSITION_DEPTH` deep) — legitimately
tens of minutes. When such a tick outlives 10.5 min, a concurrent `advanceRun` sees the
run-note lock as stale, STEALS it, re-reads the run (the step still `pending` — the
first tick has not written), and re-enters `tick`. The nested workflow's *own* lock
(correctly budgeted via `workflowStaleAfterMs`) refuses the second nested run, so the
double *external* side-effect is prevented — but the second tick then takes the failure
path: with the default `retry.max=1` it calls `failRun`, which **runs the saga
(compensating already-completed steps' side effects) and writes `status:'failed'`**.
The first tick then finishes its nested run successfully and overwrites the note back to
`running`/`done` — leaving a run that reports success while its earlier steps were
already compensated (reversed). This is the exact class the composition audit fixed for
the Tier-0 lock (S1), *novel here* because Tier-2 PERSISTS state: in Tier-0 a stolen
parent lock only appended a redundant refused-run log line; in Tier-2 it corrupts the
run note and mis-fires compensations. Trigger: two drivers (the envisioned §I.3
daemon-timer + a manual advance, or two `zz run advance`) plus a `note:`-to-workflow
tick > 10.5 min. One-line fix: budget the run-note lock by the pinned step's true
worst-case — for a `note:`-to-workflow step reuse `workflowStaleAfterMs(pinned nested
steps)` (or refuse a note-ref-to-multistep-workflow whose budget exceeds
`MAX_TIMEOUT_S` in a single tick); inline/leaf ticks are already bounded ≤ the window.

**S2 · `idempotency_key` is recorded but never handed to the executing step.**
`run.mjs:374` mints the key onto the run note, and the header (`:47`) plus §I.4 #2 claim
a side-effecting tool note "can recognize a duplicate invocation" — but neither
`runInlineStep` (`:226`, `runGated(...inputs...)`) nor `runNoteRefStep` (`:236`,
`act(...stepInputs...)`) passes the key into the child's env/inputs, so a tool has no
way to see it. At-least-once retries are therefore not actually de-dupable; the key is
decorative. Since the whole tier's honesty story is "at-least-once + idempotency keys,"
recording a key the executor can't read is a subtle over-claim. One-line fix: inject the
key alongside the `ZZ_*` inputs (e.g. `ZZ_IDEMPOTENCY_KEY`) so the outbox pattern (§I.2
B5) can dedupe — or soften the header to "recorded for the future outbox, not yet
exposed."

**S3 · No concurrency test and no at-least-once re-execution test.** `run.test.mjs`
covers crash-recovery-by-hand-patch, generation-pin, retry/saga/irreversible,
wait/signal/complete, and idempotent no-op re-advance (concern 7) — but NOT the
run-note lock's core job (two concurrent advances on one run → the second refused
`running:true`), and NOT the died-after-spawn / before-write window (a step re-executing
on re-tick). Both are the failure modes the tier exists to survive. Add: a lock-held
refusal test, and (for S1) a stolen-lock scenario. One-line fix: add a test that holds
the run lock (or drives two advances) and asserts the second returns `{running:true}`.

## NIT

- **N1 · validate.mjs accepts a garbage `wait.timeout`.** `validate.mjs:98-104` only
  checks `wait.on`; a `wait:{on,timeout:'garbage'}` step LANDS (write-time linter passes)
  and is only caught later by `startRun`'s `stepShapeError` (`run.mjs:150`). Minor
  linter/runner divergence — validate the duration at write time too, or accept the
  fail-at-start.
- **N2 · A `wait` step inside a note-ref'd (composed) workflow fails opaquely.** Tier-0
  `runWorkflow`'s `stepShapeError` (`use/workflow.mjs:99`) doesn't know the `wait` kind,
  so a composed waiting sub-workflow errors as "needs either run or note" rather than a
  clear "waits are unsupported in a synchronous composed sub-invocation." Correct to
  refuse (durability can't recurse into Tier-0), but the message misleads.
- **N3 · `checkWaitTimeout` never fails a waiting step with a missing/unparseable
  `started`.** `run.mjs:326` — `Number.isFinite(startedAt)` false → returns null → the
  step waits forever. Fails safe (toward waiting, not spurious failure) but silently.
- **N4 · One git commit per tick — unbounded run history.** Every `writeRun` →
  `evolve → commit → mint` mints a runs-module generation = one git commit per step.
  A long or oft-ticked run bloats git history; the §I.4 anti-pattern ("run-notes must
  stay compact/compactable") is acknowledged in the spec but has no compaction path yet.
- **N5 · `noteAsOf` inherits `commitForN`'s position-based lookup.**
  `generation.mjs:63-67` maps gen `n` → the `n-1`th grep-matched commit by POSITION, not
  by the trailer number. Correct in a healthy repo, but if a mint ever fail-softed its
  commit (ledger advanced, no commit — the documented fail-soft path) the index
  mis-resolves a later generation's bytes. Pre-existing in generation.mjs, now on the
  runner's critical (pin) path — worth a trailer-number lookup eventually.

## Bottom line

The keystone is sound: pinning is real, the moat is closed, at-least-once is honestly
built, and the saga is correct. Ship after S1 (the lock budget — a genuine
stateful-concurrency bug that WILL bite once the daemon/trigger rung drives concurrent
ticks), and fold in S2 (make the idempotency key usable, or stop claiming it is) and S3
(test the lock and the re-tick). The NITs are polish. The single-driver path shipping
today is correct as-is.

## Fixed (2026-07-03)

All three SHOULD-FIXes landed as gated, individually green commits on
`feat/personal-app-roadmap`; two NITs folded in as a fourth. 624/624 tests green
(617 baseline + 7 new).

| Finding | Commit | What changed |
|---|---|---|
| **S1** — run-note lock under-budgets a `note:`-to-workflow tick | `db00517` | `runNoteLockBudgetMs` peeks (lock-free) at the step `advanceRun` is about to tick; when it's a `note:` step whose target is a `type: workflow`, the lock is sized via `workflowStaleAfterMs` over THAT workflow's own steps (the same primitive already fixing Tier-0 composition's lock) instead of the fixed `MAX_TIMEOUT_S`+grace ceiling. Every other step shape (inline `run:`, `wait:`, note-ref-to-leaf-action) keeps the unchanged fixed budget. **Chose per-tick sizing over the audit's offered fallback** (rejecting note-ref-to-workflow steps in a single tick) — see "S1: which approach" below. Two new tests: a slow multi-step nested workflow's lock window covers it (concurrent advance refused, not stolen, until genuinely past the new budget); a note-ref-to-leaf-action keeps the old fixed ceiling unaffected. |
| **S2** — `idempotency_key` recorded but never delivered | `cef39c7` | `withIdempotencyKey` folds the run's per-step key into the step's `ZZ_*` inputs (matching `act()`/`runGated`'s existing `ZZ_${k}` env convention), so both `runInlineStep` and `runNoteRefStep` now deliver it to the child process as `ZZ_IDEMPOTENCY_KEY`. Three new tests: an inline step's child sees the documented `${runId}:${stepId}` key; a retried step sees the IDENTICAL key on every attempt (1 of 1 unique value across 3 executions); a note-ref (leaf action via `act()`) also delivers it. |
| **S3** — no concurrency / crash-window tests | `1da5994` | Two new tests, no production change: (a) the lock's core job — two concurrent `advanceRun` calls on one run, the second refused `{running:true}`, the step never double-executed; (b) the died-after-spawn-before-write window — hand-construct a step whose side effect "ran" (attempt/started/idempotency_key already set) but the note still shows `pending` (mirrors the existing crash-recovery test's pattern), then assert at-least-once re-execution AND that the idempotency key is identical pre/post re-execution (a real tool could dedup against it). |
| **N1** (nit) — garbage `wait.timeout` passes validate | `753724f` | `validate.mjs`'s workflow-step axis now also rejects an unparseable `wait.timeout` at the write door (a local duration regex — not an import of `run.mjs`'s `DURATION_RE`, keeping `notes/` acyclic). `startRun`'s own `stepShapeError` check is left in place as defense-in-depth. Updated the existing garbage-timeout test to assert the (now-primary) write-door refusal. |
| **N3** (nit) — `checkWaitTimeout` waits forever on a bad `started` | `753724f` | A missing/unparseable `started` on a step with a DECLARED `wait.timeout` now fails safe toward progress (treated as timed out) instead of silently waiting forever — a one-line condition flip. |
| N2, N4, N5 | deferred | Not trivial (≤2 lines): N2 needs a clearer error message path through Tier-0's `stepShapeError`; N4 (unbounded run history) needs a compaction design; N5 (`noteAsOf`'s position-based generation lookup) needs a trailer-number-keyed rewrite of `commitForN`. Left for a follow-up. |

### S1: which approach, and why

Chose **per-tick lock sizing** (`runNoteLockBudgetMs`) over the audit's offered
fallback (refusing a note-ref-to-workflow step in a single durable tick). The
fallback would have been simpler, but `note-ref: a note: step targeting ANOTHER
workflow recurses through Tier-0 runWorkflow` (`tests/unit/run.test.mjs`) already
exercises composition end-to-end as a load-bearing feature of the tier's stated
design (§I rung 1's composition, extended to Tier-2 by `runNoteRefStep`) — rejecting
the shape would have silently regressed working functionality to close a sizing bug,
not a shape bug. Per-tick sizing fixes the actual defect (the BUDGET was wrong, not
the FEATURE) and mirrors the fix already applied to Tier-0's own composition lock
(`workflowStaleAfterMs`, `use/workflow.mjs`) — one budgeting primitive, reused, rather
than two different doctrines for the same shape at two tiers.

### Deviations from the fix sketches

None load-bearing. S1's docstring on `advanceRun` previously asserted the note-ref
step "budgets the lock at the same generous ceiling the Tier-0 composition audit
settled on" — that claim was aspirational, not implemented; it now accurately
describes the actual (new) per-tick behavior. `resolveWait`'s lock was left on the
fixed ceiling (unchanged, just renamed to the shared `DEFAULT_RUN_LOCK_MS` constant
for DRY) since it never executes a step — over-provisioning there is safe, only
under-provisioning (S1's actual bug) is dangerous.

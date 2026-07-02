// src/use/workflow.mjs — run a multi-step workflow note (a DAG of run-steps).
//
// what: execute a `type: workflow` note — its `steps` (each a `run` OR a `note`,
//       plus optional `depends-on`) in topological order, each through the SAME
//       execution gate as `act`. Stop on the first failure and run completed
//       steps' `compensate` commands in reverse (saga-style — the one place
//       note-ops need compensation, because steps have external shell side
//       effects).
// why:  `act` runs a single command; a repeated multi-step procedure is a workflow.
//       Reuses runGated so every step is gate + allowlist checked, like any run.
// how:  Kahn topo-sort → sequential gated execution → capture per step. Read-only on
//       notes (it runs commands, writes none). Zero-dep, fail-soft.
//
// COMPOSITION (§I rung 1 — "Zus that run"): a step is EITHER `run:` (an inline shell
// string, unchanged) OR `note:` (a `module:id` reference to ANOTHER runnable note),
// never both — `stepShapeError` rejects both/neither before anything runs. A `note:`
// target is resolved at RUN time (not pre-validated — a workflow may reference a note
// that doesn't exist yet, same as a step ordering just not having run yet) into one of
// two shapes, mirroring what a top-level caller would do with that same address:
//   - a LEAF runnable note (has `run:`, `type` anything but `workflow`) → invoked via
//     `act()` — the exact same gated + timed + logged path a standalone `zz act` uses.
//   - ANOTHER `type: workflow` note → RECURSED into via `runWorkflow` itself, so a
//     workflow can compose workflows arbitrarily deep (bounded — see below).
// Composed steps are still Tier-0/1 invocations (§I.3) — composition reuses the exact
// same synchronous, gated, timed primitives; it does not introduce a new execution
// tier or any async/durable machinery.
//
// GATING: a composed invocation carries the SAME `actor` as the parent run — threaded
// explicitly through every recursive/`act()` call, never defaulted — so an
// agent-initiated composed workflow keeps its fail-CLOSED posture all the way down
// (see gate-actor.test.mjs's pattern, extended to composition in workflow-compose.test.mjs).
//
// LOCKING: a composed LEAF action note goes through `act()`'s own `acquireRunLock` for
// ITS OWN `module:id` — so a workflow can't double-fire an action that's ALSO running
// standalone elsewhere (refused, same as any concurrent `zz act`). A composed WORKFLOW
// note likewise acquires ITS OWN lock inside the recursive `runWorkflow` call. Neither
// case re-locks the PARENT workflow's own `module:id` — that lock is acquired ONCE, at
// the top of this function, for the whole run; steps (inline or composed) never touch
// it again. "A workflow does not lock its own transitive steps redundantly, but every
// distinct runnable note a workflow touches — inline steps aside, they have no note of
// their own — still respects its OWN lock."
//
// CYCLES: a note-ref step whose target is a `type: workflow` note is checked against a
// VISITED SET of `module:id` addresses carried down the recursion (every workflow on
// the current call stack, root included) — a target already in that set is an ancestor
// referencing itself, transitively: refused as `{ok:false, error:'workflow cycle: …'}`
// BEFORE any lock is attempted (so a direct self-reference can't deadlock on its own
// run-lock — it fails as a named cycle instead). `MAX_COMPOSITION_DEPTH` is a backstop
// for a long ACYCLIC chain (no repeated address, so the visited-set alone never fires).
//
// NESTING ORDER on failure — the precise sequence, outer→inner, when a note-ref step's
// target is a WORKFLOW that fails: the parent's step loop calls `runWorkflow` on the
// target; THAT CALL runs to completion synchronously, including its OWN inner saga
// (its completed steps' `compensate` commands, in reverse) — by the time control
// returns to the parent's step loop, the inner rollback has ALREADY happened. The
// parent then treats the whole nested failure as just THIS step's failure and, if it
// has no further steps to try, runs ITS OWN saga over ITS OWN completed steps. So a
// failure at composition depth N runs N nested-saga passes before the root's, each one
// fully finished before the next begins — never interleaved (there is no concurrency
// here; everything is synchronous spawnSync underneath).
//
// RUNS.JSONL ATTRIBUTION: every composed invocation's own run-log entry (a leaf
// action's `logRun` inside `act()`, or a nested workflow's own `logRun` at the bottom
// of this function) carries `via: '<module:id>'` — the IMMEDIATE parent workflow's own
// address, not the root's — so the runs-miner (§I rung 2) can walk composed failures
// edge by edge. A non-composed (top-level) run carries no `via` at all (unchanged
// shape) — see `notes/log.mjs`'s `logRun`.
//
// Deferred (Temporal-grade): per-step idempotency `key` + persisted resume — a step
// re-runs each invocation today; add a key/cursor when long workflows need resume.

import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../notes/note.mjs';
import { itemPath, repoRoot } from '../notes/store.mjs';
import { readManifest } from '../notes/module.mjs';
import { logRun } from '../notes/log.mjs';
import { runGated, resolveTimeoutMs, act, MAX_TIMEOUT_S } from './act.mjs';
import { acquireRunLock, LOCK_GRACE_MS } from './run-lock.mjs';

// Backstop for a long ACYCLIC note-ref chain (the visited-set is the PRIMARY cycle
// defense — this only fires when no address repeats, so the set never flags a cycle).
// Generous on purpose: no legitimate composition needs anywhere near this deep.
export const MAX_COMPOSITION_DEPTH = 20;

/** Split a `module:id` note-ref address. Null on anything malformed (no colon, or an
 *  empty module/id segment) — `stepShapeError` below turns that into a clean, named
 *  validation error rather than a runtime surprise. Exported: the Tier-2 durable
 *  runner (`grow/run.mjs`) parses the SAME `module:id` shape for its `note:` steps
 *  and its own `workflow:` run-note field — one address grammar, not a second copy. */
export function splitAddr(addr) {
  const s = String(addr ?? '');
  const i = s.indexOf(':');
  if (i <= 0 || i >= s.length - 1) return null;
  return { module: s.slice(0, i), id: s.slice(i + 1) };
}

/** A step is EITHER `run:` OR `note:`, never both/neither; a `note:` value must parse
 *  as `module:id`. Returns an error string, or null when the step's shape is valid. */
function stepShapeError(s) {
  if (!s || !s.id) return 'every step needs an id';
  const hasRun = typeof s.run === 'string' && s.run.trim() !== '';
  const hasNote = typeof s.note === 'string' && s.note.trim() !== '';
  if (hasRun && hasNote) return `step '${s.id}' has both run and note — a step is one or the other`;
  if (!hasRun && !hasNote) return `step '${s.id}' needs either run or note`;
  if (hasNote && !splitAddr(s.note)) return `step '${s.id}' note ref '${s.note}' must be 'module:id'`;
  return null;
}

/** Topologically order steps by `depends-on`; null on a cycle / missing dep. Exported:
 *  the Tier-2 durable runner (`grow/run.mjs`) reuses this SAME validation + ordering
 *  at `run start` time (it stores the run's `steps` in this order, then ticks the
 *  first READY one each advance — same dependency doctrine, one implementation). */
export function topoSort(steps) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const deps = new Map(steps.map((s) => [s.id, [].concat(s['depends-on'] ?? []).filter(Boolean)]));
  for (const ds of deps.values()) if (ds.some((d) => !byId.has(d))) return null; // dangling dep
  const indeg = new Map(steps.map((s) => [s.id, deps.get(s.id).length]));
  const queue = steps.filter((s) => indeg.get(s.id) === 0).map((s) => s.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const s of steps) if (deps.get(s.id).includes(id)) { indeg.set(s.id, indeg.get(s.id) - 1); if (indeg.get(s.id) === 0) queue.push(s.id); }
  }
  return order.length === steps.length ? order.map((id) => byId.get(id)) : null; // cycle → null
}

/**
 * The workflow-wide lock staleness window: the worst-case total time a legitimate
 * run could still be holding the lock. That's every step's own resolved timeout
 * (the run phase) PLUS, for every step that carries a `compensate`, a compensation
 * timeout budget (the rollback phase) — a failure downstream of several completed
 * steps runs compensations for ALL of them in reverse. The compensation loop below
 * calls `runGated` with NO per-step timeout override, so each compensation actually
 * runs at `resolveTimeoutMs()`'s DEFAULT (not the step's own `timeout:`, which only
 * governs the primary run) — budget that same default, not the step's `timeout`, so
 * the window matches what can really happen. Without this term a late failure whose
 * full rollback runs near the compensation default could outlive the window and let
 * a concurrent invocation steal the lock mid-rollback — the exact double-run the
 * lock exists to prevent, at the most fragile moment.
 *
 * NOTE (composition, audit S1 fixed 2026-07-03): a `note:` step's TRUE runtime is
 * unknown at the parent's lock-acquisition time — the target may be a leaf action (its
 * own declared `timeout:`, usually the 120s default) or a nested WORKFLOW that can
 * legitimately run far longer (its own steps + its own compensation phase, recursively).
 * Budgeting it like an ordinary inline step under-budgets the parent's window, letting a
 * concurrent re-invocation see a still-live lock as stale and steal it mid-nested-run —
 * the exact double-run the lock exists to prevent (docs/audits/2026-07-03-composition-
 * review.md S1). So a `note:` step with NO explicit `timeout:` of its own is budgeted at
 * `MAX_TIMEOUT_S` (the 600s cap) — a floor, not a precise estimate, but one that can't be
 * blown by a legitimately long nested run. A `note:` step that DOES carry an explicit
 * `timeout:` (author-declared intent) is honored as before. Composition depth is still
 * bounded by `MAX_COMPOSITION_DEPTH` as the correctness backstop; the lock itself stays
 * advisory (like every other lock in this codebase).
 */
export function workflowStaleAfterMs(steps) {
  const runBudget = steps.reduce((sum, s) => {
    const ms = s.note && s.timeout == null ? MAX_TIMEOUT_S * 1000 : resolveTimeoutMs(s.timeout);
    return sum + ms;
  }, 0);
  const compensateBudget = steps.filter((s) => s.compensate).length * resolveTimeoutMs();
  return runBudget + compensateBudget + LOCK_GRACE_MS;
}

/**
 * Run one note-ref step (`{ note: 'module:id' }`): resolve the target and invoke it
 * through the SAME path a top-level caller would use for that address — `act()` for a
 * leaf runnable note, a recursive `runWorkflow` for a nested `type: workflow` note —
 * normalized to the shell-step result shape `{ran, success, exitCode, denied,
 * timedOut, error}` so the caller's saga/compensation loop treats a composed step
 * exactly like an inline `run:` step. See this file's header comment for the full
 * gating/locking/cycle/nesting-order doctrine. Never throws (fail-soft, like the rest
 * of this module) — an unsafe/malformed target address surfaces as a step failure,
 * not a crash.
 */
function runNoteRefStep(home, module, id, step, { inputs, actor, visited, depth }) {
  try {
    const addr = splitAddr(step.note); // shape already validated — non-null here
    const targetPath = itemPath(home, addr.module, addr.id);
    if (!existsSync(targetPath)) return { ran: false, success: false, error: `step '${step.id}' targets missing note '${step.note}'` };
    const { note: target } = parse(readFileSync(targetPath, 'utf8'), { id: addr.id });
    if (!target) return { ran: false, success: false, error: `step '${step.id}' targets an unparseable note '${step.note}'` };

    const via = `${module}:${id}`; // the IMMEDIATE parent — not the composition root
    // a step's OWN `inputs:` wins; absent, the parent workflow's inputs pass through
    // unchanged — a nested workflow inherits its caller's ZZ_* context by default.
    const stepInputs = step.inputs && typeof step.inputs === 'object' ? step.inputs : inputs;

    if (target.type === 'workflow') {
      // recurse — cycle/depth checked by the callee's own top-of-function guard
      // (the SAME check the root call makes on itself), so there is exactly one
      // place that logic lives.
      const nested = runWorkflow(home, addr.module, addr.id, stepInputs, actor, { visited, depth: depth + 1, via });
      const attempted = Array.isArray(nested.steps); // false ⇒ refused before running anything (cycle · depth cap · lock · not-a-workflow · missing note)
      return { ran: attempted, success: !!nested.ok, exitCode: nested.ok ? 0 : 1, error: nested.error, running: nested.running, nested };
    }

    if (!target.run) {
      return { ran: false, success: false, error: `step '${step.id}' targets '${step.note}' which is not runnable (no run) and not a workflow` };
    }
    // the SAME path `act()` gives any top-level caller: its own run-lock (refuses a
    // note that's independently running elsewhere), its own module's/note's policy,
    // gated + timed + logged — with `via` riding the ctx so its `logRun` attributes
    // this run back to the composing workflow.
    const manifest = readManifest(home, addr.module);
    const ctx = { home, module: addr.module, manifest, actor, via };
    const r = act(ctx, addr.id, stepInputs);
    return { ran: r.ran, success: !!r.ok, exitCode: r.exitCode, denied: r.denied, timedOut: r.timedOut, running: r.running, error: r.error };
  } catch (e) {
    return { ran: false, success: false, error: `step '${step.id}' note ref failed: ${e?.message ?? String(e)}` };
  }
}

/**
 * Run a workflow note. `actor` ('operator' default | 'agent', stamped at the dispatch
 * boundary and threaded here from wire.mjs's `flow` registration) rides into every
 * step's runGated/act()/nested-runWorkflow call — an unattended agent actor fails
 * CLOSED on a malformed rule / engine error / `ask` verdict (guardrails/gate.mjs); an
 * interactive operator keeps the original fail-open, ask-passes contract. The run
 * lock (use/run-lock.mjs) is acquired ONCE for the whole workflow — steps share it (a
 * per-step lock would let two invocations interleave step-by-step, which defeats the
 * point); a composed step's OWN target note gets its OWN lock (see header comment).
 *
 * `_composition` is INTERNAL recursion state (`{visited, depth, via}`) — a note-ref
 * step passes it through when recursing into a nested workflow. External callers
 * never pass a 6th argument; the default starts a fresh composition tree.
 * @returns {{ ok, steps?, failedStep?, compensations?, error?, running? }}
 */
export function runWorkflow(home, module, id, inputs = {}, actor = 'operator', _composition = null) {
  const { visited, depth, via } = _composition ?? { visited: new Set(), depth: 0, via: null };
  const path = itemPath(home, module, id);
  if (!existsSync(path)) return { ok: false, error: `no note '${module}:${id}'` };
  const { note } = parse(readFileSync(path, 'utf8'), { id });
  if (note?.type !== 'workflow' || !Array.isArray(note.steps) || !note.steps.length) return { ok: false, error: `'${id}' is not a workflow (needs type: workflow + steps)` };
  for (const s of note.steps) {
    const shapeErr = stepShapeError(s);
    if (shapeErr) return { ok: false, error: shapeErr };
  }
  const ordered = topoSort(note.steps);
  if (!ordered) return { ok: false, error: 'workflow steps have a cycle or a dangling depends-on' };

  const selfAddr = `${module}:${id}`;
  // Cycle guard: THIS address is already on the composition call stack (an ancestor
  // note-ref'd it, directly or transitively) — refuse before touching the run lock,
  // so a self-referencing chain fails as a clean, named cycle instead of deadlocking
  // on its own lock (mkdirSync would just see an existing, non-stale dir and report
  // "already running", which is true but not the actionable answer).
  if (visited.has(selfAddr)) return { ok: false, error: `workflow cycle: ${[...visited, selfAddr].join('→')}` };
  if (depth > MAX_COMPOSITION_DEPTH) return { ok: false, error: `workflow composition too deep (depth cap ${MAX_COMPOSITION_DEPTH})` };
  const nextVisited = new Set(visited).add(selfAddr);

  // one lock for the WHOLE workflow; its staleness window is the worst-case total
  // run + rollback time (see workflowStaleAfterMs).
  const staleAfterMs = workflowStaleAfterMs(ordered);
  const lock = acquireRunLock(home, module, id, staleAfterMs);
  if (!lock.ok) return { ok: false, ...lock };

  try {
    const allow = readManifest(home, module).policy?.run?.allow ?? null;
    const root = repoRoot();
    const results = [];
    const done = [];
    for (const step of ordered) {
      // a step's own `timeout:` overrides the run default (resolveTimeoutMs, act.mjs)
      // for an INLINE `run:` step; a `note:` step's own timeout is the TARGET note's
      // declared `timeout:` (act()/runWorkflow() resolve that themselves) — a timed-out
      // step, either shape, is just another failed step, falling into the same
      // saga-compensation path below.
      const r = step.note
        ? runNoteRefStep(home, module, id, step, { inputs, actor, visited: nextVisited, depth })
        : runGated(home, module, step.run, { allow, inputs, cwd: root, timeout: step.timeout, actor });
      results.push({ id: step.id, ran: r.ran, success: !!r.success, exitCode: r.exitCode, denied: r.denied, timedOut: !!r.timedOut, note: step.note });
      if (!r.ran || !r.success) {
        // compensate completed steps in reverse (saga rollback for side effects) — if
        // THIS step was a note-ref to a workflow that itself failed, its OWN inner
        // saga already ran to completion (synchronously, inside runNoteRefStep, above)
        // before we ever got here — see the header comment's "nesting order".
        const compensations = [];
        for (const s of [...done].reverse()) if (s.compensate) {
          const c = runGated(home, module, s.compensate, { allow, inputs, cwd: root, actor });
          compensations.push({ id: s.id, success: !!c.success });
        }
        logRun(home, module, id, { inputs, success: false, timedOut: !!r.timedOut, actor, via });
        return { ok: false, failedStep: step.id, error: r.error ?? `step '${step.id}' failed (exit ${r.exitCode})`, steps: results, compensations };
      }
      done.push(step);
    }
    logRun(home, module, id, { inputs, success: true, actor, via });
    return { ok: true, steps: results };
  } finally {
    lock.release();
  }
}

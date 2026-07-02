// src/grow/run.mjs — the Tier-2 DURABLE RUNNER: "the run is a note" (§I.3 / §I.4).
//
// what: turn a `type: workflow` note into a `type: run` note — a state machine in
//       frontmatter (per-step status/attempts/idempotency key/waiting-on) — and TICK
//       it one step at a time. NO long-lived process: `startRun` materializes the
//       state machine at step 0 (does not execute); `advanceRun` loads the run note,
//       executes EXACTLY ONE ready step through the SAME gated/timed/locked act()
//       path Tier 0/1 use, and writes the new state back through the one write door.
//       Crash-safety = the note IS the state — a re-tick after a crash just re-reads
//       it. `advanceAll` is a bounded convenience loop (still sequential ticks in one
//       process, never a daemon) that stops at waiting/done/failed.
// why:  §I.3's inversion — zuzuu is the CONTROL PLANE (definition, governance, state,
//       learning), never a long-running execution ENGINE (Temporal's decade-hard
//       problem). A 3-day human wait (a run note sitting at `waiting: form-42`) is
//       just a STATE, visible in the table, resumed by a command — not a process kept
//       alive for 3 days.
// how:  Tier 0's `runWorkflow` (use/workflow.mjs) runs a WHOLE DAG synchronously in
//       one process; this is its async sibling — same primitives (act()/runGated,
//       acquireRunLock, topoSort), but each call advances ONE step and PERSISTS.
//
// THE MODEL (where run notes live, and why): a DEDICATED `runs` module (not the
// workflow's own module) — cardinality stays visible per §I.2 B1 (every durable run,
// across every workflow, is one uniform table), and a run note's own lifecycle (its
// `status`, its per-step state) has nothing to do with the WORKFLOW module's schema.
// `runs` deliberately sits OUTSIDE `module-templates.mjs`'s `STANDARD_MODULES` (the
// closed set of five us-owned kinds, pinned by its own test) — it gets its own small
// bespoke manifest (`ensureRunsModule`, below), materialized on first use like any
// grown module.
//
//   - a run note pins `workflow_generation` at `start` time (Temporal's "patching"
//     fix — read the def AS-OF that gen forever; a later workflow edit never mutates
//     an in-flight run). `notes/generation.mjs`'s `noteAsOf` is the as-of read, and
//     `advanceRun` calls it FRESH on every tick (never a live re-read of the workflow
//     note, and never relies solely on a start-time snapshot) — the literal "advance
//     reads the def AS-OF workflow_generation" the spec calls for.
//   - a step is ONE OF `run:` | `note:` | `wait:{on,timeout?}` — never more than one
//     (mirrors workflow.mjs's run/note exclusivity, extended with a third kind).
//     §I.4 #6 names a FOUR-kind vocabulary (run|note-ref|wait|gate); this rung keeps
//     it to three — a human-approval pause is already expressible as a `wait` on an
//     approval signal, so a separate `gate` kind is deferred as unnecessary duplication
//     until a real use case needs the distinction (documented deviation, see report).
//   - AT-LEAST-ONCE, not exactly-once: a tick executes the step's side effect, THEN
//     writes the note ONCE at the end (not a two-phase claim/commit) — "each step is
//     one short invocation." A process death mid-step can leave it re-attempted on the
//     NEXT tick (the note still shows the step `pending`, since the only write is at
//     the end). `idempotency_key` is STABLE across retries of the same step (minted
//     once, on first attempt — never re-minted per attempt) so a side-effecting tool
//     note can recognize a duplicate invocation (§I.4 #2's outbox doctrine).
//   - `retry: {max}` — a failed run/note-ref step under max stays `pending` (re-picked
//     next tick, `attempts` already incremented); at/over max it's `failed`, which
//     fails the WHOLE run (mirrors Tier 0's stop-on-first-failure — no partial-DAG
//     continuation of unrelated branches) and fires the saga.
//   - the saga compensates DONE steps in reverse COMPLETION order (`completed_order`,
//     persisted — the durable twin of Tier 0's in-process `done` array), exactly like
//     workflow.mjs — except it STOPS (never skips-and-continues) at the first
//     `irreversible: true` step it meets walking backward: honesty over a fake
//     rollback (§I.2 B3) — steps completed EARLIER than the irreversible one are left
//     un-compensated too, and the run note records exactly how far compensation got.
//   - a `wait` step transitions the STEP to `waiting` + the RUN to `status: waiting,
//     waiting_on: <signal>` and the tick STOPS there — `signalRun` (by signal name) or
//     `completeStep` (by step id) resolves it, flipping the run back to `running` so
//     the next advance proceeds. A DECLARED `wait.timeout` is evaluated LAZILY on the
//     next advance that touches a waiting run (no scheduler this rung — §I rung 4,
//     triggers, is explicitly deferred) — an elapsed wait fails the step (and the run)
//     exactly like any other failed step, with the same saga treatment.

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse, serialize } from '../notes/note.mjs';
import { itemPath, manifestPath, repoRoot } from '../notes/store.mjs';
import { readNote } from '../notes/repo.mjs';
import { readManifest } from '../notes/module.mjs';
import { generations, noteAsOf } from '../notes/generation.mjs';
import { logRun } from '../notes/log.mjs';
import { createNote } from './edit.mjs';
import { evolve } from './evolve.mjs';
import { runGated, act, MAX_TIMEOUT_S } from '../use/act.mjs';
import { acquireRunLock, LOCK_GRACE_MS } from '../use/run-lock.mjs';
import { runWorkflow, topoSort, splitAddr, workflowStaleAfterMs } from '../use/workflow.mjs';

export const RUNS_MODULE = 'runs';
// no `retry:` declared on a step ⇒ this many total attempts (1 = no retry — the first
// failure fails the run immediately, same as Tier 0's un-retried steps).
export const DEFAULT_RETRY_MAX = 1;

const REFUSED_NON_OPERATOR = { ok: false, error: 'write requires an operator (the agent proposes via stage→review)', refused: true };
const nowIso = () => new Date().toISOString();
// The fixed ceiling: one leaf action/inline step's own worst case (act()'s own
// timeout, clamped ≤ MAX_TIMEOUT_S) + grace. Correct for every tick EXCEPT a `note:`
// step whose target is a nested WORKFLOW — see `runNoteLockBudgetMs` (S1, below).
const DEFAULT_RUN_LOCK_MS = MAX_TIMEOUT_S * 1000 + LOCK_GRACE_MS;

// ── the `runs` module — a bespoke manifest OUTSIDE STANDARD_MODULES (see header) ──

const RUNS_FIELDS = [
  { name: 'workflow', type: 'text', required: true, label: 'Workflow', description: "the module:id of the workflow note this run was started from" },
  { name: 'workflow_generation', type: 'number', required: true, label: 'Generation', description: 'the workflow generation this run is PINNED to (§I.4 #1) — read forever, never the live def' },
  { name: 'status', type: 'select', required: true, options: ['running', 'waiting', 'done', 'failed'], label: 'Status' },
  { name: 'waiting_on', type: 'text', label: 'Waiting on', description: 'the signal name a waiting run is blocked on' },
  { name: 'failed_step', type: 'text', label: 'Failed step' },
];

/** Materialize the `runs` module's manifest on first use (idempotent) — mirrors
 *  `notes/module-templates.mjs`'s `ensureModuleManifest`, but `runs` deliberately sits
 *  outside `STANDARD_MODULES` (that set is pinned to the five us-owned kinds by its
 *  own test), so it gets its own small bespoke schema here instead. */
function ensureRunsModule(home) {
  const path = manifestPath(home, RUNS_MODULE);
  if (existsSync(path)) return false;
  mkdirSync(join(dirname(path), 'items'), { recursive: true });
  writeFileSync(path, serialize({
    id: RUNS_MODULE, type: 'module', title: 'Runs', note_type: 'run',
    capabilities: ['query', 'check'], fields: RUNS_FIELDS,
    goal: 'Durable state machines for in-flight and completed workflow executions — Tier 2 (§I.3): the run is a note.',
  }));
  return true;
}

// ── durations (`wait.timeout`) — a small, local parser (no scheduler consumes it
// yet; it's evaluated lazily — see `checkWaitTimeout`) ──────────────────────────

const DURATION_RE = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i;
const DURATION_UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Parse a duration (`'48h'` · `'2d'` · `'30m'` · a bare number = ms) to milliseconds.
 *  `null` on anything unparseable — callers treat that as "no timeout declared". */
export function parseDurationMs(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const m = DURATION_RE.exec(String(raw ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n * DURATION_UNIT_MS[(m[2] || 'ms').toLowerCase()];
}

// ── step shape (run | note | wait — see header) ─────────────────────────────────

function stepKind(s) {
  const hasRun = typeof s?.run === 'string' && s.run.trim() !== '';
  const hasNote = typeof s?.note === 'string' && s.note.trim() !== '';
  const hasWait = s?.wait && typeof s.wait === 'object' && typeof s.wait.on === 'string' && s.wait.on.trim() !== '';
  if ([hasRun, hasNote, hasWait].filter(Boolean).length !== 1) return null;
  return hasWait ? 'wait' : hasNote ? 'note' : 'run';
}

/** A step is EITHER `run:` OR `note:` OR `wait:{on,timeout?}` — never more/fewer than
 *  one. Returns an error string, or null when the step's shape is valid. */
function stepShapeError(s) {
  if (!s || !s.id) return 'every step needs an id';
  const kind = stepKind(s);
  if (!kind) return `step '${s.id}' needs exactly one of run, note, or wait`;
  if (kind === 'note' && !splitAddr(s.note)) return `step '${s.id}' note ref '${s.note}' must be 'module:id'`;
  if (kind === 'wait' && s.wait.timeout != null && parseDurationMs(s.wait.timeout) == null) {
    return `step '${s.id}' wait.timeout '${s.wait.timeout}' is not a valid duration`;
  }
  return null;
}

// ── run ids ───────────────────────────────────────────────────────────────────

function newRunId(workflowId) {
  return `${workflowId}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

// ── the write door: every run-note mutation is ONE `evolve()` call (a batch-of-one
// over `grow/commit.mjs`, the sole writer) — never a raw write ─────────────────────

function writeRun(home, runId, change, actor) {
  return evolve(home, RUNS_MODULE, { id: `advance-${runId}`, op: 'update', target: runId, change }, actor);
}

// ── start: materialize the state machine at step 0 — does NOT execute ───────────

/**
 * `zz run start` — read the workflow note, snapshot its ACTIVE generation, validate
 * the step DAG (shape + topo order, same doctrine as Tier 0's `runWorkflow`), and
 * create the run note through the operator write path. Returns the run id — nothing
 * has executed yet.
 * @returns {{ok, runId?, run?, error?, refused?}}
 */
export function startRun(home, workflowModule, workflowId, inputs = {}, actor = 'operator') {
  if (actor !== 'operator') return REFUSED_NON_OPERATOR;
  const live = readNote(home, workflowModule, workflowId);
  if (!live) return { ok: false, error: `no note '${workflowModule}:${workflowId}'` };
  if (live.type !== 'workflow' || !Array.isArray(live.steps) || !live.steps.length) {
    return { ok: false, error: `'${workflowId}' is not a workflow (needs type: workflow + steps)` };
  }
  // PIN: the module's ACTIVE generation at start time — every sanctioned creation
  // path mints on write, so a live note is always present in its module's latest
  // generation commit (see header). No generation history ⇒ the note never went
  // through the one write door (a raw file write, e.g. a test fixture) — refuse
  // rather than pin an ungoverned def.
  const gen = generations(home, workflowModule).active;
  if (gen == null) return { ok: false, error: `workflow module '${workflowModule}' has no generation history yet — commit it through the write door first` };
  const pinned = noteAsOf(home, workflowModule, workflowId, gen);
  if (!pinned.ok) return { ok: false, error: pinned.error };
  const def = pinned.note;
  if (def.type !== 'workflow' || !Array.isArray(def.steps) || !def.steps.length) {
    return { ok: false, error: `'${workflowId}' at generation ${gen} is not a workflow` };
  }
  for (const s of def.steps) {
    const err = stepShapeError(s);
    if (err) return { ok: false, error: err };
  }
  const ordered = topoSort(def.steps);
  if (!ordered) return { ok: false, error: 'workflow steps have a cycle or a dangling depends-on' };

  ensureRunsModule(home);
  const runId = newRunId(workflowId);
  const now = nowIso();
  const steps = ordered.map((s) => ({
    id: s.id, status: 'pending', attempts: 0, started: null, ended: null,
    idempotency_key: null, waiting_on: null, exit_code: null, error: null,
  }));
  const note = {
    type: 'run', title: `Run: ${workflowModule}:${workflowId}`, status: 'running',
    workflow: `${workflowModule}:${workflowId}`, workflow_generation: gen,
    waiting_on: null, failed_step: null, actor, inputs,
    steps, completed_order: [], compensations: [],
    created_at: now, started_at: now, updated_at: now, ended_at: null,
  };
  const res = createNote(home, RUNS_MODULE, runId, note, { actor });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, runId, run: readNote(home, RUNS_MODULE, runId) };
}

// ── step execution — the SAME gated/timed path Tier 0/1 use ─────────────────────

// S2 (audit 2026-07-03-durable-runner-review.md): fold the run's own `idempotency_key`
// into the step's `ZZ_*` inputs (matching `act()`/`runGated`'s existing `ZZ_${k}` env
// convention) — so it actually reaches the executing process as `ZZ_IDEMPOTENCY_KEY`,
// not just recorded on the note. Stable across retries (the key is minted ONCE, never
// re-minted per attempt — see `tick`), so a tool that dedupes on it sees the SAME value
// every re-invocation of the same step.
function withIdempotencyKey(inputs, idempotencyKey) {
  return idempotencyKey ? { ...inputs, IDEMPOTENCY_KEY: idempotencyKey } : inputs;
}

function runInlineStep(home, workflowModule, def, inputs, actor, idempotencyKey) {
  const allow = readManifest(home, workflowModule).policy?.run?.allow ?? null;
  return runGated(home, workflowModule, def.run, { allow, inputs: withIdempotencyKey(inputs, idempotencyKey), cwd: repoRoot(), timeout: def.timeout, actor });
}

/** A `note:` step, Tier-2 flavor: mirrors `use/workflow.mjs`'s composition — a leaf
 *  runnable note goes through `act()` (its own lock/gate/logRun); a `type: workflow`
 *  target is invoked via a FRESH Tier-0 `runWorkflow` (one bounded, synchronous
 *  sub-invocation — "one short invocation" holds even when that invocation is a
 *  whole nested DAG). `via` attributes the run.jsonl entry back to this durable run. */
function runNoteRefStep(home, def, inputs, actor, runId, idempotencyKey) {
  const addr = splitAddr(def.note);
  if (!addr) return { ran: false, success: false, error: `note ref '${def.note}' must be 'module:id'` };
  const targetPath = itemPath(home, addr.module, addr.id);
  if (!existsSync(targetPath)) return { ran: false, success: false, error: `note ref targets missing note '${def.note}'` };
  const { note: target } = parse(readFileSync(targetPath, 'utf8'), { id: addr.id });
  if (!target) return { ran: false, success: false, error: `note ref targets an unparseable note '${def.note}'` };
  const stepInputs = withIdempotencyKey(def.inputs && typeof def.inputs === 'object' ? def.inputs : inputs, idempotencyKey);
  const via = `${RUNS_MODULE}:${runId}`;
  if (target.type === 'workflow') {
    const nested = runWorkflow(home, addr.module, addr.id, stepInputs, actor, { visited: new Set(), depth: 0, via });
    return { ran: Array.isArray(nested.steps), success: !!nested.ok, exitCode: nested.ok ? 0 : 1, error: nested.error };
  }
  if (!target.run) return { ran: false, success: false, error: `note ref '${def.note}' is not runnable and not a workflow` };
  const manifest = readManifest(home, addr.module);
  const r = act({ home, module: addr.module, manifest, actor, via }, addr.id, stepInputs);
  return { ran: r.ran, success: !!r.ok, exitCode: r.exitCode, denied: r.denied, timedOut: r.timedOut, error: r.error };
}

// ── the saga (mirrors workflow.mjs's reverse-compensation loop, honoring `irreversible`) ──

function runSaga(home, workflowModule, run, defs) {
  const byId = new Map(run.steps.map((s) => [s.id, s]));
  const allow = readManifest(home, workflowModule).policy?.run?.allow ?? null;
  const root = repoRoot();
  const compensations = [];
  for (const id of [...(run.completed_order ?? [])].reverse()) {
    const s = byId.get(id);
    const d = defs.get(id);
    if (!s || s.status !== 'done' || !d) continue;
    if (d.irreversible) { compensations.push({ id, irreversible: true, compensated: false }); break; } // STOP — honesty over a fake rollback (§I.2 B3)
    if (d.compensate) {
      const c = runGated(home, workflowModule, d.compensate, { allow, inputs: run.inputs, cwd: root, actor: run.actor });
      compensations.push({ id, success: !!c.success });
    }
  }
  return compensations;
}

/** Fail the run: mark it `failed`, run the saga over its completed steps (in reverse
 *  completion order, stopping at the first `irreversible` step), write once, and log
 *  the terminal outcome under the WORKFLOW's own module/id (so `observeRuns`/the
 *  runs-miner mines a durable run's outcome exactly like a Tier-0/1 run's). `run` must
 *  already carry the failing step's terminal `steps` entry (status:'failed', ended). */
function failRun(home, runId, run, failedStepId, errorMsg, actor) {
  const addr = splitAddr(run.workflow);
  const defs = new Map();
  if (addr) {
    const pinned = noteAsOf(home, addr.module, addr.id, run.workflow_generation);
    if (pinned.ok) for (const s of pinned.note.steps ?? []) defs.set(s.id, s);
  }
  const compensations = addr ? runSaga(home, addr.module, run, defs) : [];
  const now = nowIso();
  const w = writeRun(home, runId, {
    steps: run.steps, status: 'failed', failed_step: failedStepId, error: errorMsg,
    compensations, updated_at: now, ended_at: now,
  }, actor);
  if (!w.ok) return { ok: false, error: w.error };
  if (addr) logRun(home, addr.module, addr.id, { inputs: run.inputs, success: false, actor: run.actor });
  return { ok: false, status: 'failed', failedStep: failedStepId, error: errorMsg, compensations };
}

function finishRun(home, runId, run, actor) {
  const addr = splitAddr(run.workflow);
  const now = nowIso();
  const w = writeRun(home, runId, { status: 'done', updated_at: now, ended_at: now }, actor);
  if (!w.ok) return { ok: false, error: w.error };
  if (addr) logRun(home, addr.module, addr.id, { inputs: run.inputs, success: true, actor: run.actor });
  return { ok: true, status: 'done', ticked: false };
}

// ── wait-timeout: evaluated LAZILY, on the next advance that touches a waiting run
// (no scheduler this rung — §I rung 4, triggers, is deferred) ─────────────────────

function waitingPinnedDef(home, run) {
  const addr = splitAddr(run.workflow);
  if (!addr) return null;
  const pinned = noteAsOf(home, addr.module, addr.id, run.workflow_generation);
  if (!pinned.ok) return null;
  const defs = new Map((pinned.note.steps ?? []).map((s) => [s.id, s]));
  const step = run.steps.find((s) => s.status === 'waiting');
  if (!step) return null;
  return { step, def: defs.get(step.id) };
}

function checkWaitTimeout(home, run) {
  const found = waitingPinnedDef(home, run);
  if (!found?.def?.wait?.timeout) return null;
  const ms = parseDurationMs(found.def.wait.timeout);
  if (ms == null) return null;
  // N3 (audit 2026-07-03-durable-runner-review.md): a missing/unparseable `started`
  // used to bypass the timeout entirely (waiting forever, silently) — a DECLARED
  // timeout means a bound was intended, so a corrupted `started` fails safe toward
  // PROGRESS (timed out now) rather than an unbounded hang.
  const startedAt = Date.parse(found.step.started ?? '');
  if (Number.isFinite(startedAt) && Date.now() - startedAt < ms) return null;
  return { stepId: found.step.id, signal: found.def.wait.on };
}

// ── the tick — advances EXACTLY ONE step ─────────────────────────────────────────

function tick(home, runId, run, actor) {
  if (run.status === 'done' || run.status === 'failed') return { ok: true, status: run.status, ticked: false };

  if (run.status === 'waiting') {
    const timedOut = checkWaitTimeout(home, run);
    if (!timedOut) return { ok: true, status: 'waiting', ticked: false, waitingOn: run.waiting_on };
    const now = nowIso();
    const errorMsg = `wait '${timedOut.signal}' timed out`;
    const nextSteps = run.steps.map((s) => (s.id === timedOut.stepId ? { ...s, status: 'failed', ended: now, error: errorMsg } : s));
    return failRun(home, runId, { ...run, steps: nextSteps }, timedOut.stepId, errorMsg, actor);
  }
  if (run.status !== 'running') return { ok: false, error: `run '${runId}' has an unrecognized status '${run.status}'` };

  const addr = splitAddr(run.workflow);
  if (!addr) return { ok: false, error: `run '${runId}' has a malformed workflow ref '${run.workflow}'` };
  const pinned = noteAsOf(home, addr.module, addr.id, run.workflow_generation);
  if (!pinned.ok) return { ok: false, error: pinned.error };
  const defs = new Map((pinned.note.steps ?? []).map((s) => [s.id, s]));

  const byStatus = new Map(run.steps.map((s) => [s.id, s.status]));
  const ready = run.steps.find((s) => {
    if (s.status !== 'pending') return false;
    const def = defs.get(s.id);
    if (!def) return false;
    const deps = [].concat(def['depends-on'] ?? []).filter(Boolean);
    return deps.every((d) => byStatus.get(d) === 'done');
  });

  if (!ready) {
    if (run.steps.length && run.steps.every((s) => s.status === 'done')) return finishRun(home, runId, run, actor);
    return { ok: false, error: `run '${runId}': no ready step (dependency deadlock — should not happen after start-time validation)` };
  }

  const def = defs.get(ready.id);
  if (!def) return { ok: false, error: `run '${runId}': step '${ready.id}' has no pinned definition at generation ${run.workflow_generation}` };
  const kind = stepKind(def) ?? (def.run ? 'run' : def.note ? 'note' : 'wait');
  const now = nowIso();
  const nextSteps = run.steps.map((s) => ({ ...s }));
  const target = nextSteps.find((s) => s.id === ready.id);
  target.attempts += 1;
  if (!target.started) target.started = now; // the FIRST attempt's timestamp — retries keep it
  if (!target.idempotency_key) target.idempotency_key = `${runId}:${ready.id}`; // stable across retries

  if (kind === 'wait') {
    target.status = 'waiting';
    target.waiting_on = def.wait.on;
    const w = writeRun(home, runId, { steps: nextSteps, status: 'waiting', waiting_on: def.wait.on, updated_at: now }, actor);
    if (!w.ok) return { ok: false, error: w.error };
    return { ok: true, status: 'waiting', step: ready.id, waitingOn: def.wait.on };
  }

  const result = kind === 'run'
    ? runInlineStep(home, addr.module, def, run.inputs, actor, target.idempotency_key)
    : runNoteRefStep(home, def, run.inputs, actor, runId, target.idempotency_key);

  target.exit_code = result.exitCode ?? null;
  target.error = result.error ?? null;

  if (result.ran && result.success) {
    target.status = 'done';
    target.ended = now;
    const completedOrder = [...(run.completed_order ?? []), ready.id];
    if (nextSteps.every((s) => s.status === 'done')) {
      const w = writeRun(home, runId, { steps: nextSteps, completed_order: completedOrder, status: 'done', updated_at: now, ended_at: now }, actor);
      if (!w.ok) return { ok: false, error: w.error };
      logRun(home, addr.module, addr.id, { inputs: run.inputs, success: true, actor: run.actor });
      return { ok: true, status: 'done', step: ready.id };
    }
    const w = writeRun(home, runId, { steps: nextSteps, completed_order: completedOrder, updated_at: now }, actor);
    if (!w.ok) return { ok: false, error: w.error };
    return { ok: true, status: 'running', step: ready.id };
  }

  // failure: retry (stay pending, re-picked next tick) or fail the whole run (saga)
  const declaredMax = def.retry?.max;
  const max = Number.isFinite(declaredMax) && declaredMax > 0 ? declaredMax : DEFAULT_RETRY_MAX;
  if (target.attempts < max) {
    target.status = 'pending';
    const w = writeRun(home, runId, { steps: nextSteps, updated_at: now }, actor);
    if (!w.ok) return { ok: false, error: w.error };
    return { ok: true, status: 'running', retrying: ready.id, attempts: target.attempts };
  }
  target.status = 'failed';
  target.ended = now;
  const errorMsg = result.error || `step '${ready.id}' failed (exit ${result.exitCode ?? '?'})`;
  return failRun(home, runId, { ...run, steps: nextSteps }, ready.id, errorMsg, actor);
}

/**
 * S1 fix (audit 2026-07-03-durable-runner-review.md): the run-note lock's staleness
 * window, sized to the SPECIFIC step this tick is about to advance rather than a fixed
 * ceiling. A `note:` step whose target is a nested WORKFLOW can legitimately run far
 * longer than any single leaf action's timeout (Σ its own steps, recursively — exactly
 * what `workflowStaleAfterMs` already budgets for Tier-0 composition, the same fix
 * applied there under this same audit). Under the OLD fixed budget
 * (`DEFAULT_RUN_LOCK_MS`), a concurrent advance could see a still-legitimately-running
 * nested tick as stale, STEAL the lock, re-read the still-`pending` step, and fail the
 * run (running the saga over already-completed steps) while the original tick was
 * still in flight — the original tick then finishes and overwrites the note back to
 * `done`, reporting SUCCESS over steps that were already compensated. Sizing the lock
 * to the ready step's true worst case closes that window without giving up note-ref-
 * to-workflow composition (see the report for why that was chosen over the audit's
 * offered fallback — rejecting the shape outright).
 *
 * Peeked WITHOUT holding the lock — the authoritative read + tick happens only AFTER
 * `acquireRunLock` succeeds, same as before. Two concurrent callers peeking the SAME
 * not-yet-mutated run note compute the SAME budget, which is all correctness needs: the
 * first to win `acquireRunLock` proceeds under a window sized for what it is actually
 * about to do; the second, refused, judges the held lock's age against that identical
 * window rather than a ceiling too small for the work underway.
 */
function runNoteLockBudgetMs(home, run) {
  if (!run || run.status !== 'running') return DEFAULT_RUN_LOCK_MS; // waiting/done/failed ticks never spawn a step
  const addr = splitAddr(run.workflow);
  if (!addr) return DEFAULT_RUN_LOCK_MS;
  const pinned = noteAsOf(home, addr.module, addr.id, run.workflow_generation);
  if (!pinned.ok) return DEFAULT_RUN_LOCK_MS;
  const defs = new Map((pinned.note.steps ?? []).map((s) => [s.id, s]));
  const byStatus = new Map(run.steps.map((s) => [s.id, s.status]));
  const ready = run.steps.find((s) => {
    if (s.status !== 'pending') return false;
    const def = defs.get(s.id);
    if (!def) return false;
    const deps = [].concat(def['depends-on'] ?? []).filter(Boolean);
    return deps.every((d) => byStatus.get(d) === 'done');
  });
  const def = ready && defs.get(ready.id);
  if (!def?.note) return DEFAULT_RUN_LOCK_MS; // inline run / wait / no ready step — the fixed ceiling already covers it ("as today")
  const target = splitAddr(def.note);
  const targetPath = target && itemPath(home, target.module, target.id);
  if (!targetPath || !existsSync(targetPath)) return DEFAULT_RUN_LOCK_MS;
  const { note: targetNote } = parse(readFileSync(targetPath, 'utf8'), { id: target.id });
  // the SAME live (unpinned) resolution `runNoteRefStep` itself uses for a note-ref
  // TARGET — a note-ref to a leaf action is already covered by the fixed ceiling
  // (act()'s own timeout is clamped ≤ MAX_TIMEOUT_S); only a nested WORKFLOW target
  // needs its own (potentially much larger) budget.
  if (targetNote?.type !== 'workflow' || !Array.isArray(targetNote.steps) || !targetNote.steps.length) return DEFAULT_RUN_LOCK_MS;
  return workflowStaleAfterMs(targetNote.steps);
}

/**
 * `zz run advance` — the TICK. Loads the run note, executes EXACTLY ONE ready step
 * through the same gated/timed path `act()`/`runGated` use, writes the new state back
 * through the write door, and returns what it did. A re-tick after a crash simply
 * re-reads the note — there is no other state. Locked per run-id (one tick at a time
 * per run); the lock's staleness window is sized PER-TICK to the step about to run
 * (`runNoteLockBudgetMs`, S1 fix 2026-07-03) rather than a fixed ceiling.
 * @returns {{ok, status?, step?, retrying?, waitingOn?, failedStep?, compensations?, error?, ticked?}}
 */
export function advanceRun(home, runId, actor = 'operator') {
  if (actor !== 'operator') return REFUSED_NON_OPERATOR;
  const pre = readNote(home, RUNS_MODULE, runId);
  if (!pre) return { ok: false, error: `no run '${runId}'` };
  const lock = acquireRunLock(home, RUNS_MODULE, runId, runNoteLockBudgetMs(home, pre));
  if (!lock.ok) return { ok: false, error: lock.error, running: true };
  try {
    const run = readNote(home, RUNS_MODULE, runId); // fresh, inside the lock
    if (!run) return { ok: false, error: `no run '${runId}'` };
    if (run.type !== 'run') return { ok: false, error: `'${runId}' is not a run` };
    return tick(home, runId, run, actor);
  } finally {
    lock.release();
  }
}

/**
 * `zz run advance --all` — a BOUNDED convenience loop (still sequential ticks in one
 * process, never a daemon): ticks until the run reaches `done`/`waiting`/`failed`, or
 * a genuine tick error occurs, or `maxTicks` is exceeded (a safety cap, not a hang).
 * @returns {{ok, ticks, status, error?, failedStep?, compensations?}}
 */
export function advanceAll(home, runId, actor = 'operator', { maxTicks = 1000 } = {}) {
  const ticks = [];
  let last;
  for (let i = 0; i < maxTicks; i++) {
    last = advanceRun(home, runId, actor);
    ticks.push(last);
    if (last.status === 'done' || last.status === 'waiting' || last.status === 'failed') {
      return { ok: last.status !== 'failed', ticks, status: last.status, error: last.error, failedStep: last.failedStep, compensations: last.compensations };
    }
    if (!last.ok) return { ok: false, ticks, status: last.status, error: last.error }; // a genuine tick error, not a workflow outcome — bail
  }
  return { ok: false, ticks, status: last?.status ?? 'running', error: `advance --all stopped after ${maxTicks} ticks (a bounded loop, not a daemon) without reaching done/waiting/failed` };
}

// ── waits: resolve by signal name or by step id ──────────────────────────────────

function resolveWait(home, runId, matchFn, label, actor) {
  if (actor !== 'operator') return REFUSED_NON_OPERATOR;
  if (!readNote(home, RUNS_MODULE, runId)) return { ok: false, error: `no run '${runId}'` };
  // resolveWait never runs a step (it just flips a wait to done) — the fixed ceiling
  // is hugely over-provisioned here, which is safe (a too-generous lock costs nothing
  // but potential wait; a too-STINGY one is the actual danger S1 fixes above).
  const lock = acquireRunLock(home, RUNS_MODULE, runId, DEFAULT_RUN_LOCK_MS);
  if (!lock.ok) return { ok: false, error: lock.error, running: true };
  try {
    const run = readNote(home, RUNS_MODULE, runId);
    if (!run) return { ok: false, error: `no run '${runId}'` };
    if (run.status !== 'waiting') return { ok: false, error: `run '${runId}' is not waiting (status: ${run.status})` };
    const target = (run.steps ?? []).find(matchFn);
    if (!target) return { ok: false, error: `no waiting step matches ${label} on run '${runId}'` };
    const now = nowIso();
    const nextSteps = run.steps.map((s) => (s.id === target.id ? { ...s, status: 'done', ended: now, waiting_on: null } : s));
    const completedOrder = [...(run.completed_order ?? []), target.id];
    const w = writeRun(home, runId, { steps: nextSteps, completed_order: completedOrder, status: 'running', waiting_on: null, updated_at: now }, actor);
    if (!w.ok) return { ok: false, error: w.error };
    return { ok: true, step: target.id };
  } finally {
    lock.release();
  }
}

/** `zz run signal <run-id> <signal-name>` — resolve a waiting run by its wait's `on`
 *  signal name. Flips the step to `done` and the run back to `running` (the NEXT
 *  advance proceeds; this call itself does not tick further). */
export function signalRun(home, runId, signal, actor = 'operator') {
  return resolveWait(home, runId, (s) => s.status === 'waiting' && s.waiting_on === signal, `signal '${signal}'`, actor);
}

/** `zz run complete <run-id> <step-id>` — resolve a waiting run by step id directly
 *  (works even when the caller doesn't know/care about the wait's signal name). */
export function completeStep(home, runId, stepId, actor = 'operator') {
  return resolveWait(home, runId, (s) => s.id === stepId && s.status === 'waiting', `step '${stepId}'`, actor);
}

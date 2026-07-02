// §I rung "the durable runner" (Tier 2, §I.3/§I.4) — the run is a note. Deep tests
// for grow/run.mjs: start materializes state (no execution), advance ticks one step,
// deps ordering, wait stops the tick, signal/complete resume it, generation-pin holds
// across a live workflow edit, idempotent re-advance is a no-op, retry-to-max then
// the saga, irreversible stops the saga, and crash-recovery = re-tick from the note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, utimesSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNote } from '../../src/grow/edit.mjs';
import { patchNote } from '../../src/grow/edit.mjs';
import { serialize } from '../../src/notes/note.mjs';
import { evolve } from '../../src/grow/evolve.mjs';
import { readNote } from '../../src/notes/repo.mjs';
import { readManifest } from '../../src/notes/module.mjs';
import { noteAsOf, generations } from '../../src/notes/generation.mjs';
import { cacheDir } from '../../src/notes/store.mjs';
import { acquireRunLock, LOCK_GRACE_MS } from '../../src/use/run-lock.mjs';
import { workflowStaleAfterMs } from '../../src/use/workflow.mjs';
import { MAX_TIMEOUT_S } from '../../src/use/act.mjs';
import {
  startRun, advanceRun, advanceAll, signalRun, completeStep,
  RUNS_MODULE, DEFAULT_RETRY_MAX, parseDurationMs,
} from '../../src/grow/run.mjs';

const runLockDir = (home, runId) => join(cacheDir(home), 'run-locks', `${RUNS_MODULE}__${runId}.lock`);

// A durable run's generation pin is git-backed (noteAsOf reads via `git show`), so
// every test needs a REAL repo — mirrors tests/unit/commit.test.mjs's `withRepo`.
function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-run-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}

// Workflow notes MUST land through the real write door (createNote → commit → mint)
// — a raw file write (the pattern tests/unit/workflow.test.mjs uses for the Tier-0/1
// SYNCHRONOUS runner) has no generation history, so `startRun` would correctly refuse
// it (see the dedicated test for that refusal, below).
function putWorkflow(home, module, id, steps, extra = {}) {
  const r = createNote(home, module, id, { type: 'workflow', title: id, steps, ...extra });
  assert.equal(r.ok, true, `fixture workflow '${id}' committed: ${r.error}`);
  return r;
}

// ── start: materializes step 0, does NOT execute ─────────────────────────────────

test('run start: materializes the state machine — every step pending, nothing executed', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [
      { id: 'a', run: 'true' },
      { id: 'b', run: 'true', 'depends-on': 'a' },
    ]);
    const r = startRun(home, 'actions', 'flow', { lead: 'acme' });
    assert.equal(r.ok, true);
    assert.match(r.runId, /^flow-[0-9a-f]{8}$/);
    assert.equal(r.run.type, 'run');
    assert.equal(r.run.status, 'running');
    assert.equal(r.run.workflow, 'actions:flow');
    assert.equal(r.run.workflow_generation, generations(home, 'actions').active);
    assert.deepEqual(r.run.inputs, { lead: 'acme' });
    assert.equal(r.run.steps.length, 2);
    assert.ok(r.run.steps.every((s) => s.status === 'pending' && s.attempts === 0 && s.started === null));
    assert.equal(r.run.completed_order.length, 0);
    // NOTHING ran — a fresh run note, no side effects at all
    assert.equal(r.run.ended_at, null);
  });
});

test('run start: mints the `runs` module on first use, OUTSIDE STANDARD_MODULES', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const r = startRun(home, 'actions', 'flow');
    assert.equal(r.ok, true);
    const manifest = readManifest(home, RUNS_MODULE);
    assert.equal(manifest.note_type, 'run');
    assert.ok(manifest.fields.some((f) => f.name === 'workflow_generation'));
    assert.ok(existsSync(join(home, RUNS_MODULE, 'items', `${r.runId}.md`)));
  });
});

test('run start: refuses a non-workflow note', () => {
  withRepo((home) => {
    createNote(home, 'actions', 'notaflow', { type: 'action', run: 'true' });
    const r = startRun(home, 'actions', 'notaflow');
    assert.equal(r.ok, false);
    assert.match(r.error, /not a workflow/);
  });
});

test('run start: refuses a workflow with no generation history (never committed through the write door)', () => {
  withRepo((home) => {
    // a RAW write (mirrors workflow.test.mjs's fixture style) — no commit(), no mint,
    // so the module's generation ledger is empty: `startRun` has nothing to pin to.
    mkdirSync(join(home, 'actions', 'items'), { recursive: true });
    writeFileSync(join(home, 'actions', 'items', 'raw.md'), serialize({ id: 'raw', type: 'workflow', title: 'raw', steps: [{ id: 'a', run: 'true' }] }));
    const r = startRun(home, 'actions', 'raw');
    assert.equal(r.ok, false);
    assert.match(r.error, /no generation history/);
  });
});

test('run start: refuses a malformed step DAG (a cycle) — same doctrine as Tier 0', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'cyc', [
      { id: 'a', run: 'true', 'depends-on': 'b' },
      { id: 'b', run: 'true', 'depends-on': 'a' },
    ]);
    const r = startRun(home, 'actions', 'cyc');
    assert.equal(r.ok, false);
    assert.match(r.error, /cycle|dangling/);
  });
});

test('a step with neither/both of run+note+wait is refused at the write door itself (validate.mjs, extended for run|note|wait)', () => {
  withRepo((home) => {
    const bad1 = createNote(home, 'actions', 'bad1', { type: 'workflow', title: 'bad1', steps: [{ id: 'a' }] });
    assert.equal(bad1.ok, false);
    assert.match(bad1.error, /exactly one of run, note, or wait/);
    const bad2 = createNote(home, 'actions', 'bad2', { type: 'workflow', title: 'bad2', steps: [{ id: 'a', run: 'true', note: 'actions:x' }] });
    assert.equal(bad2.ok, false);
    assert.match(bad2.error, /exactly one of run, note, or wait/);
  });
});

test('run start: THE MOAT — a non-operator (agent) is refused', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const r = startRun(home, 'actions', 'flow', {}, 'agent');
    assert.equal(r.ok, false);
    assert.equal(r.refused, true);
  });
});

// ── advance: ticks exactly one step, deps ordering ───────────────────────────────

test('run advance: executes ONE ready step per call, in dependency order', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [
      { id: 'b', run: 'true', 'depends-on': 'a' },
      { id: 'a', run: 'true' },
      { id: 'c', run: 'true', 'depends-on': 'b' },
    ]);
    const { runId } = startRun(home, 'actions', 'flow');
    let r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.step], [true, 'running', 'a'], 'a runs first (its dep is satisfied; b is not)');
    r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.step], [true, 'running', 'b']);
    r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.step], [true, 'done', 'c'], 'the LAST step completing flips the run to done');

    const run = readNote(home, RUNS_MODULE, runId);
    assert.equal(run.status, 'done');
    assert.equal(run.ended_at != null, true);
    assert.deepEqual(run.completed_order, ['a', 'b', 'c']);
    for (const s of run.steps) {
      assert.equal(s.status, 'done');
      assert.equal(s.exit_code, 0);
      assert.ok(s.idempotency_key.startsWith(`${runId}:`));
    }
  });
});

test('run advance: records exit code + stdout-driven success/failure faithfully', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'boom', run: 'false' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceRun(home, runId);
    assert.equal(r.ok, false);
    assert.equal(r.status, 'failed');
    const run = readNote(home, RUNS_MODULE, runId);
    assert.equal(run.steps[0].exit_code, 1);
    assert.equal(run.steps[0].status, 'failed');
  });
});

test('run advance: a run already done/failed is a no-op (ticked:false), never re-executes', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceRun(home, runId); // → done
    const before = readNote(home, RUNS_MODULE, runId);
    const r = advanceRun(home, runId);
    assert.deepEqual(r, { ok: true, status: 'done', ticked: false });
    const after = readNote(home, RUNS_MODULE, runId);
    assert.deepEqual(after, before, 'no note mutation on a no-op tick');
  });
});

test('run advance: an unknown run id is a clean error', () => {
  withRepo((home) => {
    const r = advanceRun(home, 'no-such-run');
    assert.equal(r.ok, false);
    assert.match(r.error, /no run/);
  });
});

test('run advance: THE MOAT — a non-operator (agent) is refused', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceRun(home, runId, 'agent');
    assert.equal(r.ok, false);
    assert.equal(r.refused, true);
  });
});

// ── idempotent re-advance ─────────────────────────────────────────────────────────

test('run advance: idempotency — a step already DONE is never re-picked; re-advance moves forward, not sideways', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }, { id: 'b', run: 'true', 'depends-on': 'a' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceRun(home, runId); // a
    const afterA = readNote(home, RUNS_MODULE, runId);
    const keyA = afterA.steps.find((s) => s.id === 'a').idempotency_key;
    const r = advanceRun(home, runId); // must pick b, NOT re-run a
    assert.equal(r.step, 'b');
    const after = readNote(home, RUNS_MODULE, runId);
    assert.equal(after.steps.find((s) => s.id === 'a').attempts, 1, 'a was not re-attempted');
    assert.equal(after.steps.find((s) => s.id === 'a').idempotency_key, keyA, 'a keeps its ORIGINAL idempotency key');
  });
});

// ── wait stops the tick; signal / complete resume it ─────────────────────────────

test('wait: a wait step transitions the run to `waiting` and the tick STOPS there', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [
      { id: 'a', run: 'true' },
      { id: 'w', wait: { on: 'human-ok' }, 'depends-on': 'a' },
      { id: 'b', run: 'true', 'depends-on': 'w' },
    ]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceRun(home, runId); // a
    const r = advanceRun(home, runId); // w
    assert.deepEqual([r.ok, r.status, r.step, r.waitingOn], [true, 'waiting', 'w', 'human-ok']);
    const run = readNote(home, RUNS_MODULE, runId);
    assert.equal(run.status, 'waiting');
    assert.equal(run.waiting_on, 'human-ok');
    assert.equal(run.steps.find((s) => s.id === 'w').status, 'waiting');
    // a further advance is a no-op — the tick genuinely stopped, b never ran
    const again = advanceRun(home, runId);
    assert.deepEqual(again, { ok: true, status: 'waiting', ticked: false, waitingOn: 'human-ok' });
    assert.equal(readNote(home, RUNS_MODULE, runId).steps.find((s) => s.id === 'b').status, 'pending');
  });
});

test('signal: resolves a waiting run by signal name; the run flips back to running', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'w', wait: { on: 'go' } }, { id: 'b', run: 'true', 'depends-on': 'w' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceRun(home, runId); // → waiting
    const r = signalRun(home, runId, 'go');
    assert.deepEqual(r, { ok: true, step: 'w' });
    const run = readNote(home, RUNS_MODULE, runId);
    assert.equal(run.status, 'running');
    assert.equal(run.waiting_on, null);
    assert.equal(run.steps.find((s) => s.id === 'w').status, 'done');
    const next = advanceRun(home, runId); // now b can proceed
    assert.deepEqual([next.ok, next.status, next.step], [true, 'done', 'b']);
  });
});

test('complete: resolves a waiting run by STEP id (no signal name needed)', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'w', wait: { on: 'anything' } }]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceRun(home, runId);
    const r = completeStep(home, runId, 'w');
    assert.deepEqual(r, { ok: true, step: 'w' });
    assert.equal(readNote(home, RUNS_MODULE, runId).status, 'running');
  });
});

test('signal: refused on a non-waiting run, or a signal name that matches nothing', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    assert.match(signalRun(home, runId, 'go').error, /not waiting/);
    putWorkflow(home, 'actions', 'flow2', [{ id: 'w', wait: { on: 'go' } }]);
    const started2 = startRun(home, 'actions', 'flow2');
    advanceRun(home, started2.runId);
    assert.match(signalRun(home, started2.runId, 'wrong-signal').error, /no waiting step matches/);
  });
});

test('wait: a declared timeout is evaluated LAZILY on the next advance and fails the step + run', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'w', wait: { on: 'ok', timeout: '10ms' } }]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceRun(home, runId); // → waiting
    const started = Date.now();
    while (Date.now() - started < 40) { /* busy-wait past the 10ms timeout, deterministically */ }
    const r = advanceRun(home, runId);
    assert.equal(r.ok, false);
    assert.equal(r.status, 'failed');
    assert.match(r.error, /timed out/);
    assert.equal(readNote(home, RUNS_MODULE, runId).steps[0].status, 'failed');
  });
});

test('wait: an undeclared timeout never auto-fails — a run can wait indefinitely', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'w', wait: { on: 'ok' } }]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceRun(home, runId);
    const r = advanceRun(home, runId);
    assert.deepEqual(r, { ok: true, status: 'waiting', ticked: false, waitingOn: 'ok' });
  });
});

// ── generation pinning ────────────────────────────────────────────────────────────

test('generation pin: editing the LIVE workflow after start does NOT change the in-flight run', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }, { id: 'b', run: 'true', 'depends-on': 'a' }]);
    const { runId, run } = startRun(home, 'actions', 'flow');
    const pinnedGen = run.workflow_generation;
    // edit the LIVE note: step b now fails, AND a brand new step is added
    const patched = patchNote(home, 'actions', 'flow', 'steps', [
      { id: 'a', run: 'true' }, { id: 'b', run: 'false' }, { id: 'c', run: 'true', 'depends-on': 'b' },
    ]);
    assert.equal(patched.ok, true);
    assert.ok(generations(home, 'actions').active > pinnedGen, 'the live edit minted a NEW generation');

    const r = advanceAll(home, runId);
    // the run only ever knew about {a,b} from gen `pinnedGen`, and b was `run:'true'`
    // THERE — despite the live note now failing on b and carrying a 3rd step.
    assert.equal(r.ok, true);
    assert.equal(r.status, 'done');
    const final = readNote(home, RUNS_MODULE, runId);
    assert.deepEqual(final.steps.map((s) => s.id), ['a', 'b']);
    assert.ok(final.steps.every((s) => s.status === 'done' && s.exit_code === 0));
    assert.equal(final.workflow_generation, pinnedGen, "the run's own pin field never moves");
  });
});

test('generation pin: noteAsOf reads the EXACT bytes of a past generation, not the live file', () => {
  withRepo((home) => {
    createNote(home, 'knowledge', 'k', { type: 'knowledge', title: 'v1' });
    const gen1 = generations(home, 'knowledge').active;
    patchNote(home, 'knowledge', 'k', 'title', 'v2');
    const asOf1 = noteAsOf(home, 'knowledge', 'k', gen1);
    assert.equal(asOf1.ok, true);
    assert.equal(asOf1.note.title, 'v1');
    assert.equal(readNote(home, 'knowledge', 'k').title, 'v2', 'the live file has moved on');
  });
});

test('noteAsOf: a nonexistent generation and a note absent-at-that-generation both error cleanly', () => {
  withRepo((home) => {
    createNote(home, 'knowledge', 'k', { type: 'knowledge', title: 'v1' });
    assert.match(noteAsOf(home, 'knowledge', 'k', 99).error, /no generation/);
    assert.match(noteAsOf(home, 'knowledge', 'ghost', 1).error, /no note/);
  });
});

// ── retry to max, then the saga ────────────────────────────────────────────────────

test('retry: a failed step under max stays pending and is re-picked; attempts accumulate', () => {
  withRepo((home, root) => {
    const marker = join(root, 'seen-twice');
    // fails until `marker` exists — since it never will, this always fails, letting
    // us assert the RETRY progression precisely (attempts 1 → 2 → 3, then saga)
    putWorkflow(home, 'actions', 'flow', [{ id: 'flaky', run: `test -f ${marker}`, retry: { max: 3 } }]);
    const { runId } = startRun(home, 'actions', 'flow');
    let r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.retrying, r.attempts], [true, 'running', 'flaky', 1]);
    r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.retrying, r.attempts], [true, 'running', 'flaky', 2]);
    r = advanceRun(home, runId); // 3rd attempt = max → fails the run
    assert.equal(r.ok, false);
    assert.equal(r.status, 'failed');
    assert.equal(r.failedStep, 'flaky');
    assert.equal(readNote(home, RUNS_MODULE, runId).steps[0].attempts, 3);
  });
});

test('retry: no `retry:` declared ⇒ DEFAULT_RETRY_MAX (no retry) — the first failure fails the run', () => {
  withRepo((home) => {
    assert.equal(DEFAULT_RETRY_MAX, 1);
    putWorkflow(home, 'actions', 'flow', [{ id: 'boom', run: 'false' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceRun(home, runId);
    assert.equal(r.status, 'failed');
    assert.equal(readNote(home, RUNS_MODULE, runId).steps[0].attempts, 1);
  });
});

test('saga: completed steps are compensated in REVERSE completion order on failure', () => {
  withRepo((home, root) => {
    const compA = join(root, 'comp-a');
    const compB = join(root, 'comp-b');
    putWorkflow(home, 'actions', 'flow', [
      { id: 'a', run: 'true', compensate: `touch ${compA}` },
      { id: 'b', run: 'true', compensate: `touch ${compB}`, 'depends-on': 'a' },
      { id: 'c', run: 'false', 'depends-on': 'b' },
    ]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceAll(home, runId);
    assert.equal(r.status, 'failed');
    assert.equal(r.failedStep, 'c');
    // the RETURNED order is the proof of sequence (b before a — reverse completion
    // order); both compensate commands (shell-free `touch`) actually ran too.
    assert.deepEqual(r.compensations, [{ id: 'b', success: true }, { id: 'a', success: true }]);
    assert.equal(existsSync(compA), true);
    assert.equal(existsSync(compB), true);
  });
});

test('saga: a step with no compensate is simply skipped (no entry) — not an error', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [
      { id: 'a', run: 'true' }, // no compensate declared
      { id: 'b', run: 'false', 'depends-on': 'a' },
    ]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceAll(home, runId);
    assert.equal(r.status, 'failed');
    assert.deepEqual(r.compensations, []);
  });
});

test('saga: an IRREVERSIBLE completed step STOPS the saga there — earlier steps are left uncompensated', () => {
  withRepo((home, root) => {
    const compA = join(root, 'comp-a');
    putWorkflow(home, 'actions', 'flow', [
      { id: 'a', run: 'true', compensate: `touch ${compA}` },
      { id: 'b', run: 'true', irreversible: true, 'depends-on': 'a' },
      { id: 'c', run: 'false', 'depends-on': 'b' },
    ]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceAll(home, runId);
    assert.equal(r.status, 'failed');
    assert.equal(r.failedStep, 'c');
    assert.deepEqual(r.compensations, [{ id: 'b', irreversible: true, compensated: false }]);
    assert.equal(existsSync(compA), false, "a's compensate NEVER ran — the saga stopped AT b, not past it");
  });
});

// ── advance --all: bounded convenience loop, stops at done/waiting/failed ────────

test('advanceAll: ticks to `done` and stops', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }, { id: 'b', run: 'true', 'depends-on': 'a' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceAll(home, runId);
    assert.equal(r.ok, true);
    assert.equal(r.status, 'done');
    assert.equal(r.ticks.length, 2);
  });
});

test('advanceAll: stops at `waiting` — does not spin past a wait step', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }, { id: 'w', wait: { on: 'go' }, 'depends-on': 'a' }, { id: 'b', run: 'true', 'depends-on': 'w' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceAll(home, runId);
    assert.equal(r.ok, true);
    assert.equal(r.status, 'waiting');
    assert.equal(r.ticks.length, 2, 'a then w — never touches b');
    assert.equal(readNote(home, RUNS_MODULE, runId).steps.find((s) => s.id === 'b').status, 'pending');
  });
});

test('advanceAll: stops at `failed` with the failedStep + compensations surfaced', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true', compensate: 'true' }, { id: 'b', run: 'false', 'depends-on': 'a' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceAll(home, runId);
    assert.equal(r.ok, false);
    assert.equal(r.status, 'failed');
    assert.equal(r.failedStep, 'b');
    assert.deepEqual(r.compensations, [{ id: 'a', success: true }]);
  });
});

test('advanceAll: calling it on an already-settled run is a one-tick no-op', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceAll(home, runId); // → done
    const r = advanceAll(home, runId);
    assert.equal(r.ok, true);
    assert.equal(r.status, 'done');
    assert.equal(r.ticks.length, 1);
  });
});

// ── crash-recovery: the note IS the state; a re-tick just re-reads it ────────────

test('crash-recovery: a run advanced by hand-patching the note (simulating a prior tick that landed but was never observed) resumes correctly from a FRESH call', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [
      { id: 'a', run: 'true' }, { id: 'b', run: 'true', 'depends-on': 'a' }, { id: 'c', run: 'true', 'depends-on': 'b' },
    ]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceRun(home, runId); // a done
    // Simulate "the process died right after writing b's completion, before any
    // caller observed the result" by writing that exact state directly — a
    // completely independent write, no in-memory state carried from the tick above.
    const run0 = readNote(home, RUNS_MODULE, runId);
    const now = new Date().toISOString();
    const patched = run0.steps.map((s) => (s.id === 'b' ? { ...s, status: 'done', attempts: 1, started: now, ended: now, idempotency_key: `${runId}:b` } : s));
    const w = evolve(home, RUNS_MODULE, { id: 'sim-crash', op: 'update', target: runId, change: { steps: patched, completed_order: [...run0.completed_order, 'b'] } });
    assert.equal(w.ok, true);
    // a FRESH advanceRun call — reads only the note, resumes at c
    const r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.step], [true, 'done', 'c']);
  });
});

// ── note-ref steps (Tier-2 composition) ───────────────────────────────────────────

test('note-ref: a `note:` step invokes a leaf action note via the same gated act() path', () => {
  withRepo((home, root) => {
    const marker = join(root, 'leaf-ran');
    createNote(home, 'actions', 'leaf', { type: 'action', run: `touch ${marker}` });
    putWorkflow(home, 'actions', 'flow', [{ id: 'call', note: 'actions:leaf' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.step], [true, 'done', 'call']);
    assert.equal(existsSync(marker), true);
  });
});

test('note-ref: a `note:` step targeting ANOTHER workflow recurses through Tier-0 runWorkflow (one bounded sub-invocation)', () => {
  withRepo((home, root) => {
    const marker = join(root, 'nested-ran');
    createNote(home, 'actions', 'inner', { type: 'workflow', title: 'inner', steps: [{ id: 'x', run: `touch ${marker}` }] });
    putWorkflow(home, 'actions', 'outer', [{ id: 'call', note: 'actions:inner' }]);
    const { runId } = startRun(home, 'actions', 'outer');
    const r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.step], [true, 'done', 'call']);
    assert.equal(existsSync(marker), true);
  });
});

test('note-ref: a step\'s own `inputs:` overrides the run\'s inputs (mirrors Tier-0 composition)', () => {
  withRepo((home, root) => {
    // shell-free (the run.mjs/act.mjs tokenizer is naive whitespace-split — no shell,
    // same doctrine as workflow-composition.test.mjs's echoer): a `node -e` one-liner
    // with NO internal whitespace, so it survives the split as a single token.
    const out = join(root, 'inputs-out');
    // note: env keys preserve the input key's EXACT case (`ZZ_${k}`, use/act.mjs) — 'who' → 'ZZ_who', not 'ZZ_WHO'
    const script = `require('fs').writeFileSync(${JSON.stringify(out)},process.env.ZZ_who||'none')`;
    createNote(home, 'actions', 'leaf', { type: 'action', run: `node -e ${script}` });
    putWorkflow(home, 'actions', 'flow', [{ id: 'call', note: 'actions:leaf', inputs: { who: 'step-own' } }]);
    const { runId } = startRun(home, 'actions', 'flow', { who: 'run-level' });
    const r = advanceRun(home, runId);
    assert.equal(r.status, 'done', r.error);
    assert.equal(readFileSync(out, 'utf8').trim(), 'step-own');
  });
});

test('note-ref: a missing or non-runnable target fails the step cleanly (still triggers the saga)', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow1', [{ id: 'call', note: 'actions:ghost', compensate: 'true' }]);
    const s1 = startRun(home, 'actions', 'flow1');
    const r1 = advanceRun(home, s1.runId);
    assert.equal(r1.status, 'failed');
    assert.match(r1.error, /missing note/);

    createNote(home, 'knowledge', 'fact', { type: 'knowledge', title: 'not runnable' });
    putWorkflow(home, 'actions', 'flow2', [{ id: 'call', note: 'knowledge:fact' }]);
    const s2 = startRun(home, 'actions', 'flow2');
    const r2 = advanceRun(home, s2.runId);
    assert.equal(r2.status, 'failed');
    assert.match(r2.error, /not runnable/);
  });
});

// ── durations ──────────────────────────────────────────────────────────────────────

test('parseDurationMs: parses s/m/h/d suffixes and bare numbers; rejects garbage', () => {
  assert.equal(parseDurationMs('10s'), 10_000);
  assert.equal(parseDurationMs('2m'), 120_000);
  assert.equal(parseDurationMs('1h'), 3_600_000);
  assert.equal(parseDurationMs('2d'), 172_800_000);
  assert.equal(parseDurationMs('500ms'), 500);
  assert.equal(parseDurationMs(1000), 1000);
  assert.equal(parseDurationMs('nonsense'), null);
  assert.equal(parseDurationMs('-5s'), null);
  assert.equal(parseDurationMs(0), null);
});

test('run start: a wait step with a garbage timeout is refused at start (fail fast, not at tick time)', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'w', wait: { on: 'go', timeout: 'not-a-duration' } }]);
    const r = startRun(home, 'actions', 'flow');
    assert.equal(r.ok, false);
    assert.match(r.error, /not a valid duration/);
  });
});

// ── S1 (audit 2026-07-03-durable-runner-review.md): the run-note lock's staleness
// window is sized PER-TICK to the step about to run, not a fixed ceiling — a `note:`
// step targeting a nested WORKFLOW gets that workflow's own `workflowStaleAfterMs`
// budget instead of the fixed one, closing the stolen-lock/spurious-saga window ──────

test('S1: a note-ref step targeting a slow multi-step nested workflow sizes the run-note lock to cover it — a concurrent advance mid-nested-run is REFUSED, not stolen', () => {
  withRepo((home) => {
    // three 300s-timeout inline steps: this nested workflow's OWN worst case
    // (workflowStaleAfterMs) is well past the OLD fixed ceiling (MAX_TIMEOUT_S+grace,
    // 630s) — exactly the shape the audit flags as under-budgeted.
    const innerSteps = [
      { id: 'x1', run: 'true', timeout: 300 },
      { id: 'x2', run: 'true', timeout: 300, 'depends-on': 'x1' },
      { id: 'x3', run: 'true', timeout: 300, 'depends-on': 'x2' },
    ];
    createNote(home, 'actions', 'inner', { type: 'workflow', title: 'inner', steps: innerSteps });
    putWorkflow(home, 'actions', 'outer', [{ id: 'call', note: 'actions:inner' }]);
    const { runId } = startRun(home, 'actions', 'outer');

    const oldFixedWindowMs = MAX_TIMEOUT_S * 1000 + LOCK_GRACE_MS; // the pre-fix (buggy) budget: 630s
    const newBudgetMs = workflowStaleAfterMs(innerSteps); // the correctly-sized budget for THIS nested workflow: 930s
    assert.ok(newBudgetMs > oldFixedWindowMs, 'sanity: the fixture actually exercises the under-budget gap');

    // simulate: a first advanceRun tick is mid-flight, deep inside the nested
    // workflow's own execution — hold the run-note lock, then backdate PAST the old
    // fixed window but still WELL WITHIN the new, correctly-sized one.
    const held = acquireRunLock(home, RUNS_MODULE, runId, newBudgetMs);
    assert.equal(held.ok, true);
    const dir = runLockDir(home, runId);
    const stillLegit = new Date(Date.now() - (oldFixedWindowMs + 30_000));
    utimesSync(dir, stillLegit, stillLegit);

    const r = advanceRun(home, runId);
    assert.equal(r.running, true, 'still within the note-ref-to-workflow worst-case window — refused, not stolen');
    assert.match(r.error, /already running/);
    assert.equal(readNote(home, RUNS_MODULE, runId).steps.find((s) => s.id === 'call').status, 'pending', 'the refused caller never re-picked the step');

    // past the FULL new window — now genuinely stale, steal proceeds (symmetric proof
    // the sizing is a real budget, not an unbounded lock)
    const pastNew = new Date(Date.now() - (newBudgetMs + 30_000));
    utimesSync(dir, pastNew, pastNew);
    const stolen = advanceRun(home, runId);
    assert.notEqual(stolen.running, true, 'past the full nested-workflow window — the lock was reacquired, not refused');
  });
});

test('S1: a note-ref step targeting a LEAF ACTION (not a workflow) keeps the fixed ceiling — sizing is unaffected', () => {
  withRepo((home, root) => {
    const marker = join(root, 'leaf-ran');
    createNote(home, 'actions', 'leaf', { type: 'action', run: `touch ${marker}` });
    putWorkflow(home, 'actions', 'outer', [{ id: 'call', note: 'actions:leaf' }]);
    const { runId } = startRun(home, 'actions', 'outer');

    const fixedWindowMs = MAX_TIMEOUT_S * 1000 + LOCK_GRACE_MS;
    const held = acquireRunLock(home, RUNS_MODULE, runId, fixedWindowMs);
    assert.equal(held.ok, true);
    const dir = runLockDir(home, runId);
    const pastFixed = new Date(Date.now() - (fixedWindowMs + 5_000));
    utimesSync(dir, pastFixed, pastFixed);

    const stolen = advanceRun(home, runId);
    assert.notEqual(stolen.running, true, 'a leaf-action note-ref keeps the same fixed ceiling as before — steal proceeds past it, same as pre-fix behavior');
  });
});

// ── S2 (audit 2026-07-03-durable-runner-review.md): idempotency_key reaches the
// executing step's env as ZZ_IDEMPOTENCY_KEY, and stays STABLE across a retry ──────

test('S2: an inline run step\'s child process actually sees ZZ_IDEMPOTENCY_KEY (the documented `${runId}:${stepId}` shape)', () => {
  withRepo((home, root) => {
    const log = join(root, 'idem-log');
    const script = `require('fs').appendFileSync(${JSON.stringify(log)},process.env.ZZ_IDEMPOTENCY_KEY||'none')`;
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: `node -e ${script}` }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceRun(home, runId);
    assert.equal(r.status, 'done', r.error);
    assert.equal(readFileSync(log, 'utf8').trim(), `${runId}:a`, 'the child saw the key — recorded, not decorative');
  });
});

test('S2: a RETRIED step\'s child process sees the IDENTICAL key on every attempt (a tool could dedup)', () => {
  withRepo((home, root) => {
    const log = join(root, 'idem-log');
    // ALWAYS fails (marker never appears) — every attempt records the key it saw,
    // then the run fails after retry.max attempts. `node -e` needs no whitespace.
    const script = `require('fs').appendFileSync(${JSON.stringify(log)},(process.env.ZZ_IDEMPOTENCY_KEY||'none')+'\\n');process.exit(1)`;
    putWorkflow(home, 'actions', 'flow', [{ id: 'flaky', run: `node -e ${script}`, retry: { max: 3 } }]);
    const { runId } = startRun(home, 'actions', 'flow');
    advanceRun(home, runId); // attempt 1 — retrying
    advanceRun(home, runId); // attempt 2 — retrying
    advanceRun(home, runId); // attempt 3 — max reached, run fails (saga runs, no compensate declared)
    const seen = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
    assert.equal(seen.length, 3, 'the step actually re-executed 3 times');
    assert.ok(seen.every((k) => k !== 'none'), 'every attempt saw a key');
    assert.equal(new Set(seen).size, 1, 'ALL THREE attempts saw the SAME key — stable across retries, so a tool could dedup');
    assert.equal(seen[0], readNote(home, RUNS_MODULE, runId).steps[0].idempotency_key, 'matches the key persisted on the note');
  });
});

test('S2: a note-ref step (leaf action via act()) also delivers ZZ_IDEMPOTENCY_KEY', () => {
  withRepo((home, root) => {
    const log = join(root, 'idem-log');
    const script = `require('fs').appendFileSync(${JSON.stringify(log)},process.env.ZZ_IDEMPOTENCY_KEY||'none')`;
    createNote(home, 'actions', 'leaf', { type: 'action', run: `node -e ${script}` });
    putWorkflow(home, 'actions', 'flow', [{ id: 'call', note: 'actions:leaf' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceRun(home, runId);
    assert.equal(r.status, 'done', r.error);
    assert.equal(readFileSync(log, 'utf8').trim(), `${runId}:call`);
  });
});

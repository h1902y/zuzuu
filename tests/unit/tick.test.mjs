// tests/unit/tick.test.mjs — U3, docs/plans/2026-07-06-001-feat-wake-source-tick-
// plan.md: the standalone wake-source tick core (`grow/tick.mjs`). Mirrors
// tests/unit/trigger.test.mjs + tests/unit/run-unattended-gate.test.mjs's fixture
// style (a real git repo — durable runs pin a generation via `git show`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNote } from '../../src/grow/edit.mjs';
import { readNote, listNoteIds } from '../../src/notes/repo.mjs';
import { tick, decideTick } from '../../src/grow/tick.mjs';
import { RUNS_MODULE } from '../../src/grow/run.mjs';
import { acquireTickLock, readWatermark } from '../../src/grow/tick-state.mjs';

function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-tick-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}

const enableAutonomy = (home, enabled = true) =>
  createNote(home, 'instructions', 'autonomy', { type: 'autonomy', title: 'Autonomy', autonomy_enabled: enabled });

const putWorkflow = (home, id, steps) => {
  const r = createNote(home, 'actions', id, { type: 'workflow', title: id, steps });
  assert.equal(r.ok, true, `fixture workflow '${id}': ${r.error}`);
};

const putCronTrigger = (home, id, { expr, run, enabled = true }) => {
  const r = createNote(home, 'actions', id, { type: 'trigger', title: id, on: { kind: 'cron', expr }, run, enabled });
  assert.equal(r.ok, true, `fixture cron trigger '${id}': ${r.error}`);
};

const putNoteChangeTrigger = (home, id, { module, noteType, where, run, enabled = true }) => {
  const r = createNote(home, 'actions', id, {
    type: 'trigger', title: id, run, enabled,
    on: { kind: 'note-change', event: 'update', module, type: noteType, where },
  });
  assert.equal(r.ok, true, `fixture note-change trigger '${id}': ${r.error}`);
};

const cronExprFor = (date) => `${date.getMinutes()} ${date.getHours()} * * *`;
const runCount = (home) => listNoteIds(home, RUNS_MODULE).length;

// ════════════════════════════════════════════════════════════════════════════
// R1 — the fail-closed opt-in
// ════════════════════════════════════════════════════════════════════════════

test('tick: opt-in OFF (no autonomy note at all) fires nothing, even with an enabled due trigger', () => {
  withRepo((home) => {
    const now = new Date();
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(now), run: 'actions:flow' });
    const r = tick(home, { now });
    assert.deepEqual(r, { fired: [], skipped: [], denied: [] }, 'absent opt-in ⇒ does nothing, not even a skip record');
    assert.equal(runCount(home), 0);
  });
});

test('tick: opt-in explicitly OFF (autonomy_enabled:false) fires nothing', () => {
  withRepo((home) => {
    enableAutonomy(home, false);
    const now = new Date();
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(now), run: 'actions:flow' });
    const r = tick(home, { now });
    assert.deepEqual(r, { fired: [], skipped: [], denied: [] });
    assert.equal(runCount(home), 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// the second gate — disabled trigger never fires, even when due
// ════════════════════════════════════════════════════════════════════════════

test('tick: a disabled trigger never fires even when its cron window is due', () => {
  withRepo((home) => {
    enableAutonomy(home);
    const now = new Date();
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(now), run: 'actions:flow', enabled: false });
    const r = tick(home, { now });
    assert.equal(r.fired.length, 0);
    assert.ok(r.skipped.some((s) => s.addr === 'actions:t1' && s.reason === 'disabled'));
    assert.equal(runCount(home), 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// R2 + R5 — cron: due-and-unseen fires once; the same window never re-fires
// ════════════════════════════════════════════════════════════════════════════

test('tick: a due, unseen cron trigger fires exactly once — the fired run carries gate_actor:agent (unattended)', () => {
  withRepo((home) => {
    enableAutonomy(home);
    const now = new Date();
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(now), run: 'actions:flow' });

    const r = tick(home, { now });
    assert.equal(r.fired.length, 1);
    assert.equal(r.denied.length, 0);
    const runId = r.fired[0].runId;
    assert.match(runId, /^flow-/);
    const run = readNote(home, RUNS_MODULE, runId);
    assert.equal(run.gate_actor, 'agent', 'fired unattended — the moat invariant');
    assert.equal(runCount(home), 1);
  });
});

test('tick: a second tick in the SAME cron window does NOT re-fire (the watermark)', () => {
  withRepo((home) => {
    enableAutonomy(home);
    const now = new Date();
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(now), run: 'actions:flow' });

    const first = tick(home, { now });
    assert.equal(first.fired.length, 1);
    const second = tick(home, { now }); // same `now` ⇒ same minute-window
    assert.equal(second.fired.length, 0);
    assert.ok(second.skipped.some((s) => s.addr === 'actions:t1' && s.reason === 'already-fired'));
    assert.equal(runCount(home), 1, 'still exactly one run — no double-fire');
  });
});

test('tick: a cron trigger NOT due (wrong minute) is skipped, not fired', () => {
  withRepo((home) => {
    enableAutonomy(home);
    const now = new Date();
    const notNow = new Date(now.getTime());
    notNow.setMinutes((now.getMinutes() + 1) % 60); // deliberately the WRONG minute
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(notNow), run: 'actions:flow' });

    const r = tick(home, { now });
    assert.equal(r.fired.length, 0);
    assert.ok(r.skipped.some((s) => s.addr === 'actions:t1' && s.reason === 'not-due'));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// R2 + R5 — note-change: fires once per NEWLY matching row
// ════════════════════════════════════════════════════════════════════════════

test('tick: note-change fires once per newly-matching row; an already-fired row is not refired; a NEW later row fires', () => {
  withRepo((home) => {
    enableAutonomy(home);
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putNoteChangeTrigger(home, 'watch', { module: 'crm', noteType: 'lead', where: ['tier>=2'], run: 'actions:flow' });
    createNote(home, 'crm', 'lead-1', { type: 'lead', title: 'l1', tier: 3 });

    const first = tick(home, { now: new Date() });
    assert.equal(first.fired.length, 1);
    assert.equal(first.fired[0].row, 'crm:lead-1');
    assert.equal(runCount(home), 1);

    // no new matching rows — the same row must not refire
    const second = tick(home, { now: new Date() });
    assert.equal(second.fired.length, 0);
    assert.ok(second.skipped.some((s) => s.addr === 'actions:watch' && s.reason === 'no-new-rows'));
    assert.equal(runCount(home), 1);

    // a genuinely NEW matching row fires
    createNote(home, 'crm', 'lead-2', { type: 'lead', title: 'l2', tier: 5 });
    const third = tick(home, { now: new Date() });
    assert.equal(third.fired.length, 1);
    assert.equal(third.fired[0].row, 'crm:lead-2');
    assert.equal(runCount(home), 2, 'lead-1 already consumed; lead-2 is a fresh fire');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// R3 — an agent-binding step never spawns; it fails cleanly (needsHost)
// ════════════════════════════════════════════════════════════════════════════

test('tick: a fired workflow with an agent-binding step ends failed/needsHost — NO agent is spawned', () => {
  withRepo((home) => {
    enableAutonomy(home);
    const now = new Date();
    createNote(home, 'actions', 'enrich', { type: 'action', title: 'enrich lead', binding: 'agent', prompt: 'use your browser tool to …' });
    putWorkflow(home, 'flow', [{ id: 'call', note: 'actions:enrich' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(now), run: 'actions:flow' });

    const r = tick(home, { now });
    assert.equal(r.fired.length, 1, 'the RUN was fired (materialized) — the step inside it is what fails');
    const runId = r.fired[0].runId;
    const run = readNote(home, RUNS_MODULE, runId);
    assert.equal(run.status, 'failed', 'advanceAll ran the step within the same tick and it failed cleanly');
    assert.match(run.error, /host session/, 'the CLI-side needsHost stub, not a spawned agent');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// R5 — idempotent under overlapping ticks (the tick lock)
// ════════════════════════════════════════════════════════════════════════════

test('tick: while another tick holds the project-wide tick lock, a second call fires NOTHING (no double-fire)', () => {
  withRepo((home) => {
    enableAutonomy(home);
    const now = new Date();
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(now), run: 'actions:flow' });

    // simulate a concurrent tick: hold the SAME lock tick() itself would acquire
    const heldLock = acquireTickLock(home);
    assert.equal(heldLock.ok, true, 'test setup: the lock is free to take');
    try {
      const r = tick(home, { now }); // this call must be refused — the lock is held
      assert.deepEqual(r.fired, []);
      assert.ok(r.skipped.some((s) => s.reason === 'tick-already-running'));
      assert.equal(runCount(home), 0, 'nothing fired while the lock was contended');
    } finally {
      heldLock.release();
    }

    // once released, a tick proceeds normally and fires exactly once
    const after = tick(home, { now });
    assert.equal(after.fired.length, 1);
    assert.equal(runCount(home), 1);
  });
});

test('tick: watermark persists across process-like re-reads — two sequential ticks never double-fire the same window', () => {
  withRepo((home) => {
    enableAutonomy(home);
    const now = new Date();
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(now), run: 'actions:flow' });
    tick(home, { now });
    const wm = readWatermark(home);
    assert.equal(typeof wm.cron['actions:t1'], 'string', 'the window key landed in the persisted watermark');
    tick(home, { now }); // a totally fresh watermark READ (not a cached in-memory one)
    assert.equal(runCount(home), 1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// the pure decision — decideTick(entries, now, watermark), no IO
// ════════════════════════════════════════════════════════════════════════════

test('decideTick: pure — correct toFire/skipped for a mixed set of entries, no project/disk involved', () => {
  const now = new Date(2026, 6, 6, 9, 15, 0); // local: 2026-07-06 09:15
  const watermark = {
    cron: { 'actions:already-fired-cron': '2026-07-06T09:15' },
    noteChange: { 'actions:watch': ['crm:seen-1'] },
  };
  const entries = [
    { addr: 'actions:disabled-one', module: 'actions', id: 'disabled-one', enabled: false, kind: 'cron', cronExpr: '15 9 * * *' },
    { addr: 'actions:due-cron', module: 'actions', id: 'due-cron', enabled: true, kind: 'cron', cronExpr: '15 9 * * *' },
    { addr: 'actions:not-due-cron', module: 'actions', id: 'not-due-cron', enabled: true, kind: 'cron', cronExpr: '16 9 * * *' },
    { addr: 'actions:already-fired-cron', module: 'actions', id: 'already-fired-cron', enabled: true, kind: 'cron', cronExpr: '15 9 * * *' },
    { addr: 'actions:watch', module: 'actions', id: 'watch', enabled: true, kind: 'note-change', matchingAddrs: ['crm:seen-1', 'crm:new-1'] },
    { addr: 'actions:manual-one', module: 'actions', id: 'manual-one', enabled: true, kind: 'manual' },
  ];

  const { toFire, skipped } = decideTick(entries, now, watermark);

  assert.deepEqual(toFire.map((f) => f.addr + (f.rowAddr ? `:${f.rowAddr}` : '')).sort(), [
    'actions:due-cron', 'actions:watch:crm:new-1',
  ].sort());

  const reasonFor = (addr) => skipped.find((s) => s.addr === addr)?.reason;
  assert.equal(reasonFor('actions:disabled-one'), 'disabled');
  assert.equal(reasonFor('actions:not-due-cron'), 'not-due');
  assert.equal(reasonFor('actions:already-fired-cron'), 'already-fired');
  assert.equal(reasonFor('actions:manual-one'), 'unsupported-kind');
});

test('decideTick: an already-fully-consumed note-change trigger (no new rows) is skipped, not fired', () => {
  const now = new Date();
  const watermark = { cron: {}, noteChange: { 'actions:watch': ['crm:a', 'crm:b'] } };
  const entries = [{ addr: 'actions:watch', module: 'actions', id: 'watch', enabled: true, kind: 'note-change', matchingAddrs: ['crm:a', 'crm:b'] }];
  const { toFire, skipped } = decideTick(entries, now, watermark);
  assert.deepEqual(toFire, []);
  assert.equal(skipped[0].reason, 'no-new-rows');
});

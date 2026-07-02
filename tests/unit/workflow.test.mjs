// Tier 2.10 — workflow notes: a DAG of gated run-steps, topo-ordered, compensating.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { runWorkflow, workflowStaleAfterMs } from '../../src/use/workflow.mjs';
import { LOCK_GRACE_MS } from '../../src/use/run-lock.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-flow-'));
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const put = (home, id, note) => {
  mkdirSync(join(home, 'actions', 'items'), { recursive: true });
  writeFileSync(join(home, 'actions', 'items', `${id}.md`), serialize({ id, ...note }));
};

test('workflow: runs steps in topological (depends-on) order', () => {
  withHome((home) => {
    // shell-free commands (the v1 tokenizer is whitespace-split, no shell); the
    // executed order is what the step results report.
    put(home, 'flow', {
      type: 'workflow', title: 'ordered',
      steps: [
        { id: 'b', run: 'true', 'depends-on': 'a' },
        { id: 'a', run: 'true' },
        { id: 'c', run: 'true', 'depends-on': 'b' },
      ],
    });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, true);
    assert.deepEqual(r.steps.map((s) => s.id), ['a', 'b', 'c'], 'a → b → c despite source order');
    assert.equal(r.steps.every((s) => s.success), true);
  });
});

test('workflow: stops on a failing step and runs compensations in reverse', () => {
  withHome((home, root) => {
    const comp = join(root, 'comp');
    put(home, 'flow', {
      type: 'workflow', title: 'failing',
      steps: [
        { id: 'setup', run: 'true', compensate: `touch ${comp}` }, // single-arg, no shell
        { id: 'boom', run: 'false', 'depends-on': 'setup' },
        { id: 'never', run: 'true', 'depends-on': 'boom' },
      ],
    });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, false);
    assert.equal(r.failedStep, 'boom');
    assert.equal(r.steps.find((s) => s.id === 'never'), undefined, 'the downstream step never ran');
    assert.equal(r.compensations.length, 1, 'setup was compensated');
    assert.equal(existsSync(comp), true, 'the compensate command ran');
  });
});

test('workflow: a cycle / dangling dep is refused', () => {
  withHome((home) => {
    put(home, 'cyc', { type: 'workflow', title: 'cyclic', steps: [{ id: 'a', run: 'true', 'depends-on': 'b' }, { id: 'b', run: 'true', 'depends-on': 'a' }] });
    assert.match(runWorkflow(home, 'actions', 'cyc').error, /cycle|dangling/);
    put(home, 'notflow', { type: 'action', run: 'true' });
    assert.match(runWorkflow(home, 'actions', 'notflow').error, /not a workflow/);
  });
});

// SF2 (audit 2026-07-03) — the lock staleness window must budget the compensation
// (rollback) phase, not just the run phase, because a failed workflow runs every
// completed step's `compensate` before releasing the lock.
test('workflowStaleAfterMs: budgets step timeouts AND a default compensation timeout per compensable step, plus grace', () => {
  const steps = [
    { id: 'a', run: 'true', compensate: 'true', timeout: 5 },   // compensable
    { id: 'b', run: 'true', compensate: 'true', timeout: 5 },   // compensable
    { id: 'c', run: 'false', timeout: 5 },                       // no compensate
  ];
  // 3 steps * 5s each (run phase) + 2 compensable steps * the compensation loop's
  // DEFAULT timeout (120s — compensations get no per-step override) + grace.
  const expected = 5_000 * 3 + 120_000 * 2 + LOCK_GRACE_MS;
  assert.equal(workflowStaleAfterMs(steps), expected);
});

test('workflowStaleAfterMs: a workflow with no compensable steps adds no rollback budget', () => {
  const steps = [{ id: 'a', run: 'true', timeout: 5 }, { id: 'b', run: 'true', timeout: 5 }];
  assert.equal(workflowStaleAfterMs(steps), 5_000 * 2 + LOCK_GRACE_MS);
});

test('workflowStaleAfterMs: a step with no declared timeout budgets the run-phase default (120s)', () => {
  assert.equal(workflowStaleAfterMs([{ id: 'a', run: 'true' }]), 120_000 + LOCK_GRACE_MS);
});

// S1 (audit 2026-07-03) — a note-ref step's true runtime is unknown at parent-lock
// time (the target may be a nested workflow running far longer than any single-step
// default), so it must be budgeted at the max, not the 120s inline-step default.
test('workflowStaleAfterMs: a note-ref step with no explicit timeout budgets MAX_TIMEOUT_S (600s), not the 120s default', () => {
  assert.equal(workflowStaleAfterMs([{ id: 'a', note: 'actions:other' }]), 600_000 + LOCK_GRACE_MS);
});

test('workflowStaleAfterMs: a note-ref step with an EXPLICIT timeout honors it rather than the max', () => {
  assert.equal(workflowStaleAfterMs([{ id: 'a', note: 'actions:other', timeout: 30 }]), 30_000 + LOCK_GRACE_MS);
});

test('workflowStaleAfterMs: mixed inline + note-ref steps budget each by its own rule', () => {
  const steps = [
    { id: 'a', run: 'true', timeout: 5 },        // inline, explicit
    { id: 'b', note: 'actions:other' },          // note-ref, no explicit timeout → max
  ];
  assert.equal(workflowStaleAfterMs(steps), 5_000 + 600_000 + LOCK_GRACE_MS);
});

// Tier 2.10 — workflow notes: a DAG of gated run-steps, topo-ordered, compensating.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { runWorkflow } from '../../src/use/workflow.mjs';

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

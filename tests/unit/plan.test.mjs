// Tier 1.1 — the change-set: plan (dry-run diff) + apply (batch → ONE generation).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageChange } from '../../src/grow/stage.mjs';
import { planFor, applyPlan } from '../../src/grow/plan.mjs';
import { approve } from '../../src/grow/review.mjs';
import { generations } from '../../src/notes/generation.mjs';

function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-plan-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const stage = (home, target, title) =>
  stageChange(home, 'knowledge', { op: 'create', target, change: { type: 'knowledge', title, body: title } });

test('plan: dry-run renders every pending change as a diff + a content id, writes nothing', () => {
  withRepo((home) => {
    stage(home, 'a', 'A'); stage(home, 'b', 'B');
    const p = planFor(home, 'knowledge');
    assert.equal(p.count, 2);
    assert.equal(p.members.every((m) => m.diff.status === 'create'), true);
    assert.match(p.planId, /^plan-[0-9a-f]{8}$/);
    // dry-run: nothing written, no generation
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'a.md')), false);
    assert.equal(generations(home, 'knowledge').active, null);
  });
});

test('apply: a batch of N changes becomes ONE generation / commit', () => {
  withRepo((home, root) => {
    stage(home, 'a', 'A'); stage(home, 'b', 'B'); stage(home, 'c', 'C');
    const r = applyPlan(home, 'knowledge');
    assert.equal(r.ok, true);
    assert.equal(r.applied, 3);
    assert.equal(r.generation, 1, 'three changes → exactly one generation');
    for (const id of ['a', 'b', 'c']) assert.ok(existsSync(join(home, 'knowledge', 'items', `${id}.md`)), `${id} written`);
    // exactly one zz-gen commit
    const log = execFileSync('git', ['-C', root, 'log', '--format=%s', '--grep', 'zz-gen: knowledge/'], { encoding: 'utf8' });
    assert.equal(log.trim().split('\n').length, 1, 'one generation commit for the whole batch');
    // the staged set is consumed
    assert.equal(planFor(home, 'knowledge').count, 0);
  });
});

test('apply: the plan id is a TOCTOU guard — a stale plan is refused', () => {
  withRepo((home) => {
    stage(home, 'a', 'A');
    const staleId = planFor(home, 'knowledge').planId;
    stage(home, 'b', 'B'); // the pending set changed after planning
    const r = applyPlan(home, 'knowledge', staleId);
    assert.equal(r.ok, false);
    assert.equal(r.stale, true);
  });
});

test('apply: nothing staged is a fail-soft no-op', () => {
  withRepo((home) => assert.equal(applyPlan(home, 'knowledge').ok, false));
});

test('apply: a single-change plan equals a single approve (degenerate case)', () => {
  withRepo((home) => {
    stage(home, 'solo', 'Solo');
    const r = applyPlan(home, 'knowledge', planFor(home, 'knowledge').planId);
    assert.equal(r.ok, true);
    assert.equal(r.applied, 1);
    assert.equal(generations(home, 'knowledge').active, 1);
  });
});

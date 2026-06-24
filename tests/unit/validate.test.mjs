// Tier 2.9 — pre-write validation: a malformed note is refused at the gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateNote } from '../../src/notes/validate.mjs';
import { stageChange } from '../../src/grow/stage.mjs';
import { approve } from '../../src/grow/review.mjs';

test('validateNote: type-keyed invariants', () => {
  assert.equal(validateNote({ type: 'knowledge', title: 'x' }).ok, true);
  assert.equal(validateNote({ title: 'no type' }).ok, false);
  assert.equal(validateNote({ type: 'rule', action: 'deny', pattern: 'rm' }).ok, true);
  assert.equal(validateNote({ type: 'rule', action: 'nope', pattern: 'rm' }).ok, false, 'bad action');
  assert.equal(validateNote({ type: 'rule', action: 'deny' }).ok, false, 'rule needs a pattern');
  assert.equal(validateNote({ type: 'action', run: 'echo' }).ok, true);
  assert.equal(validateNote({ type: 'action', title: 'no run' }).ok, false);
});

test('gate: a malformed note is refused BEFORE it is written', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-val-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  const home = join(root, '.zuzuu');
  // an action note with no `run` — staged fine, but the gate refuses to evolve it
  const p = stageChange(home, 'actions', { op: 'create', target: 'bad', change: { type: 'action', title: 'no run' } });
  const r = approve(home, 'actions', p.id);
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid note.*run/);
  rmSync(root, { recursive: true, force: true });
});

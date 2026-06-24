// Plane-3 #2/#3 — the opener (zz start) + closer (zz wrap) + the transient handoff.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { stageChange } from '../../src/grow/stage.mjs';
import { openerText, closerText, writeHandoff, readHandoff } from '../../src/serve/steering.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-steer-'));
  const home = join(root, '.zuzuu');
  mkdirSync(home, { recursive: true });
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const project = (home, fields) => writeFileSync(join(home, 'project.md'), serialize({ type: 'project', ...fields }));

test('start: renders the steering opener + goals + the recommended message', () => {
  withHome((home, root) => {
    project(home, { title: 'deck', steering: { opener: 'state the Done-when', goals: 'ship the MVP' } });
    const out = openerText(root);
    assert.match(out, /^# Start — deck/);
    assert.match(out, /state the Done-when/);
    assert.match(out, /Goals: ship the MVP/);
  });
});

test('start: falls back to a default opener when steering.opener is absent', () => {
  withHome((home, root) => {
    project(home, { title: 'deck' });
    assert.match(openerText(root), /Done-when signal/, 'a default opener is offered');
  });
});

test('start: surfaces the pending-review count', () => {
  withHome((home, root) => {
    project(home, { title: 'deck' });
    ensureModuleManifest(home, 'knowledge');
    stageChange(home, 'knowledge', { op: 'create', target: 'x', change: { type: 'knowledge', title: 'X' } });
    assert.match(openerText(root), /1 change\(s\) awaiting review/);
  });
});

test('wrap --note writes a handoff; start surfaces it next session (transient run-state)', () => {
  withHome((home, root) => {
    project(home, { title: 'deck' });
    assert.equal(readHandoff(home), '', 'no handoff initially');
    writeHandoff(home, 'finished the card model; next: the battle loop');
    assert.match(readHandoff(home), /battle loop/);
    assert.match(openerText(root), /## Where you left off\nfinished the card model; next: the battle loop/);
  });
});

test('wrap: renders the steering closer (or a default) + the review nudge', () => {
  withHome((home, root) => {
    project(home, { title: 'deck', steering: { closer: 'list decisions + next task' } });
    ensureModuleManifest(home, 'knowledge');
    stageChange(home, 'knowledge', { op: 'create', target: 'x', change: { type: 'knowledge', title: 'X' } });
    const out = closerText(root);
    assert.match(out, /^# Wrap — deck/);
    assert.match(out, /list decisions \+ next task/);
    assert.match(out, /1 change\(s\) staged — review with zz review/);
    // default closer when absent
    project(home, { title: 'deck' });
    assert.match(closerText(root), /what's blocked, and the next task/);
  });
});

test('opener & closer are deterministic (read-only)', () => {
  withHome((home, root) => {
    project(home, { title: 'deck', steering: { goals: 'g' } });
    assert.equal(openerText(root), openerText(root));
    assert.equal(closerText(root), closerText(root));
  });
});

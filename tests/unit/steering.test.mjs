// Plane-3 #2/#3 — the opener (zz start) + closer (zz wrap) + the transient handoff.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { stageChange } from '../../src/grow/stage.mjs';
import { execFileSync } from 'node:child_process';
import { initHome } from '../../src/cli/init.mjs';
import { openSession, checkpoint } from '../../src/sessions/session-git.mjs';
import { openerText, closerText, steerText, writeHandoff, readHandoff, parkItem, readParking, clearParking } from '../../src/serve/steering.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-steer-'));
  const home = join(root, '.zuzuu');
  mkdirSync(home, { recursive: true });
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const project = (home, fields) => writeFileSync(join(home, 'project.md'), serialize({ type: 'project', ...fields }));
const note = (home, module, id, n) => {
  ensureModuleManifest(home, module);
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...n }));
};

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

test('start surfaces leftover session work — mid-session-drop recovery (#7)', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-drop-'));
  const git = (args) => execFileSync('git', args, { cwd: root });
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 't@e.com']); git(['config', 'user.name', 't']); git(['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(root, 'a.txt'), 'one\n'); git(['add', '-A']); git(['commit', '-q', '-m', 'init']);
  initHome(root);
  try {
    openSession(root, 'sess-dropped-1111');           // a session opens…
    writeFileSync(join(root, 'work.txt'), 'in flight\n');
    checkpoint(root);                                  // …turn checkpoint, then the process "drops" (no close)
    const out = openerText(root);
    assert.match(out, /⚠ Leftover session work/);
    assert.match(out, /zz session continue/);
    assert.match(out, /zz session discard --yes/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('steer: shows drift signals (#6) from steering.drift', () => {
  withHome((home, root) => {
    project(home, { title: 'deck', steering: { drift: ['out-of-scope files', '>3 turns on one error'] } });
    const out = steerText(root);
    assert.match(out, /## Drift signals/);
    assert.match(out, /- out-of-scope files/);
    assert.match(out, /- >3 turns on one error/);
  });
});

test('steer: the parking lot (#6) — park items, surface them in steer + the closer', () => {
  withHome((home, root) => {
    project(home, { title: 'deck' });
    assert.deepEqual(readParking(home), []);
    parkItem(home, 'refactor the deck loader');
    parkItem(home, 'investigate the flaky test');
    assert.deepEqual(readParking(home), ['refactor the deck loader', 'investigate the flaky test']);
    assert.match(steerText(root), /## Parking lot[\s\S]*refactor the deck loader[\s\S]*investigate the flaky test/);
    assert.match(closerText(root), /Parked for next session:[\s\S]*refactor the deck loader/);
    clearParking(home);
    assert.deepEqual(readParking(home), []);
  });
});

test('steer: surfaces grown Instructions guidance to pin into steering (#4)', () => {
  withHome((home, root) => {
    project(home, { title: 'deck' });
    note(home, 'instructions', 'a', { type: 'instruction', title: 'always run tests first' });
    note(home, 'instructions', 'b', { type: 'instruction', title: 'prefer small commits' });
    const out = steerText(root);
    assert.match(out, /## Learned guidance — consider pinning/);
    assert.match(out, /- always run tests first/);
    assert.match(out, /- prefer small commits/);
  });
});

test('steer: on track when nothing set', () => {
  withHome((home, root) => {
    project(home, { title: 'deck' });
    assert.match(steerText(root), /On track/);
  });
});

test('opener & closer are deterministic (read-only)', () => {
  withHome((home, root) => {
    project(home, { title: 'deck', steering: { goals: 'g' } });
    assert.equal(openerText(root), openerText(root));
    assert.equal(closerText(root), closerText(root));
    assert.equal(steerText(root), steerText(root));
  });
});

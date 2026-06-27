// Plane-3 U1 — characterization of the session brief (digestText).
// Pins the CURRENT output byte-exact before the steering injection (U3) extends it,
// so the no-regression + determinism criteria are provable. The exact-brief test is
// the no-regression guard: with no steering + no instructions, U3 must not change it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { serialize } from '../../src/notes/note.mjs';
import { toon } from '../../src/notes/toon.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { stageChange } from '../../src/grow/stage.mjs';
import { digestText } from '../../src/serve/digest.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-digest-'));
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

test('digest: empty project (no modules) → empty string', () => {
  withHome((home, root) => {
    project(home, { title: 'demo' });
    assert.equal(digestText(root), '');
  });
});

test('digest: characterization — exact current brief (title · module table · pending line)', () => {
  withHome((home, root) => {
    project(home, { title: 'demo' });
    note(home, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    note(home, 'knowledge', 'b', { type: 'knowledge', title: 'B' });
    stageChange(home, 'knowledge', { op: 'create', target: 'c', change: { type: 'knowledge', title: 'C' } });
    // built from the same deterministic primitives (one module → no ordering ambiguity)
    const expected = `# demo — session brief\n`
      + toon('zuzuu', [{ module: 'knowledge', notes: 2, pending: 1 }], ['module', 'notes', 'pending'])
      + `\n1 proposal(s) awaiting review: zz review`;
    assert.equal(digestText(root), expected);
  });
});

test('digest: deterministic — identical output across calls', () => {
  withHome((home, root) => {
    project(home, { title: 'demo' });
    note(home, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    note(home, 'actions', 'r', { type: 'action', title: 'R', run: 'echo' });
    assert.equal(digestText(root), digestText(root));
  });
});

// ── the steering injection (U3) ───────────────────────────────────────────────

test('digest: steering.goals renders a Goals section (below the table, not the title)', () => {
  withHome((home, root) => {
    project(home, { title: 'demo', steering: { goals: 'ship the deck game' } });
    note(home, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    const out = digestText(root);
    assert.match(out, /^# demo — session brief/, 'title line unchanged');
    assert.match(out, /## Goals\nship the deck game/);
  });
});

test('digest: the Instructions module folds in as Standing guidance (top-8 + truncation marker)', () => {
  withHome((home, root) => {
    project(home, { title: 'demo' });
    for (let i = 0; i < 12; i++) note(home, 'instructions', `i${String(i).padStart(2, '0')}`, { type: 'instruction', title: `rule ${i}` });
    const out = digestText(root);
    assert.match(out, /## Standing guidance/);
    assert.equal((out.match(/^- rule /gm) || []).length, 8, 'only the top 8 shown');
    assert.match(out, /- … \(\+4 more\)/, 'the remaining count is signalled');
  });
});

// ── the code gate (U5): held sessions awaiting merge ─────────────────────────

const sh = (cwd, ...a) => spawnSync(a[0], a.slice(1), { cwd, encoding: 'utf8' });

/** A git-backed home: the digest counts held branches from the cwd's git repo. */
function withGitHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-digest-git-'));
  sh(root, 'git', 'init', '-q', '-b', 'main');
  sh(root, 'git', 'config', 'user.email', 't@t.co');
  sh(root, 'git', 'config', 'user.name', 't');
  sh(root, 'git', 'config', 'commit.gpgsign', 'false');
  const home = join(root, '.zuzuu');
  mkdirSync(home, { recursive: true });
  writeFileSync(join(root, 'a.txt'), 'hello');
  sh(root, 'git', 'add', '-A'); sh(root, 'git', 'commit', '-qm', 'init');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('digest: held sessions add an "awaiting merge" line, mirroring the proposals line', () => {
  withGitHome((home, root) => {
    project(home, { title: 'demo' });
    note(home, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    // 0 held → no line (parallel to: 0 pending → no review line)
    assert.doesNotMatch(digestText(root), /awaiting merge/);
    // 2 held → the count line appears
    sh(root, 'git', 'branch', 'zz/held-aaaa1111');
    sh(root, 'git', 'branch', 'zz/held-bbbb2222');
    assert.match(digestText(root), /\n2 session\(s\) awaiting merge: zz session merge/);
  });
});

test('digest: goals + instructions are deterministic across calls', () => {
  withHome((home, root) => {
    project(home, { title: 'demo', steering: { goals: 'g' } });
    note(home, 'instructions', 'b', { type: 'instruction', title: 'second' });
    note(home, 'instructions', 'a', { type: 'instruction', title: 'first' });
    const out = digestText(root);
    assert.equal(out, digestText(root), 'same corpus → identical brief');
    assert.ok(out.indexOf('- first') < out.indexOf('- second'), 'notes ordered by id, deterministically');
  });
});

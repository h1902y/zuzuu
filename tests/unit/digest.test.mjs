// Plane-3 U1 — characterization of the session brief (digestText).
// Pins the CURRENT output byte-exact before the steering injection (U3) extends it,
// so the no-regression + determinism criteria are provable. The exact-brief test is
// the no-regression guard: with no steering + no instructions, U3 must not change it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

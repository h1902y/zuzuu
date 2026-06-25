// Tier 1.2 — the diff primitive: pure note diff + git-backed generation diff.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { mint, diffGenerations } from '../../src/notes/generation.mjs';
import { diffNote, renderNoteDiff } from '../../src/use/diff.mjs';

// ── diffNote (pure) ───────────────────────────────────────────────────────────

test('diffNote: create — every field is an add, no before', () => {
  const d = diffNote(null, { type: 'knowledge', title: 'A', body: 'hi' });
  assert.equal(d.status, 'create');
  assert.deepEqual(d.fields.map((f) => [f.key, f.change]).sort(), [['title', 'add'], ['type', 'add']]);
  assert.equal(d.bodyChanged, true);
});

test('diffNote: delete — after is null', () => {
  assert.equal(diffNote({ type: 'knowledge', title: 'A' }, null).status, 'delete');
});

test('diffNote: update classifies add / remove / modify and ignores id', () => {
  const before = { id: 'x', type: 'knowledge', title: 'old', tags: ['a'], body: 'same' };
  const after = { id: 'x', type: 'knowledge', title: 'new', run: 'echo', body: 'same' };
  const d = diffNote(before, after);
  assert.equal(d.status, 'update');
  const m = Object.fromEntries(d.fields.map((f) => [f.key, f.change]));
  assert.deepEqual(m, { title: 'modify', tags: 'remove', run: 'add' }, 'id excluded; body unchanged');
  assert.equal(d.bodyChanged, false);
});

test('diffNote: identical envelopes → noop', () => {
  const n = { type: 'knowledge', title: 'A', body: 'b' };
  assert.equal(diffNote({ ...n }, { ...n }).status, 'noop');
});

test('renderNoteDiff: shows the op head + per-field markers', () => {
  const out = renderNoteDiff('knowledge:x', diffNote({ type: 'knowledge', title: 'old', body: 'a' }, { type: 'knowledge', title: 'new', body: 'b' }));
  assert.match(out, /~ update knowledge:x/);
  assert.match(out, /~ title: old → new/);
  assert.match(out, /~ body/);
});

// ── diffGenerations (git-backed) ──────────────────────────────────────────────

function repo() {
  const root = mkdtempSync(join(tmpdir(), 'zz-diff-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  return root;
}
const writeNote = (home, id, note) => {
  mkdirSync(join(home, 'knowledge', 'items'), { recursive: true });
  writeFileSync(join(home, 'knowledge', 'items', `${id}.md`), serialize({ id, ...note }));
};

test('diffGenerations: surfaces added / modified / deleted notes between generations', () => {
  const root = repo();
  const home = join(root, '.zuzuu');
  writeNote(home, 'a', { type: 'knowledge', title: 'A1' });
  mint(home, 'knowledge'); // gen 1 = {a}
  writeNote(home, 'a', { type: 'knowledge', title: 'A2-changed' });
  writeNote(home, 'b', { type: 'knowledge', title: 'B' });
  mint(home, 'knowledge'); // gen 2 = {a(modified), b(added)}

  const d = diffGenerations(home, 'knowledge', 1, 2);
  assert.equal(d.ok, true);
  const m = Object.fromEntries(d.changes.map((c) => [c.id, c.status]));
  assert.equal(m.a, 'M', 'a modified');
  assert.equal(m.b, 'A', 'b added');
  rmSync(root, { recursive: true, force: true });
});

test('diffGenerations: a missing generation is a fail-soft error', () => {
  const root = repo();
  const home = join(root, '.zuzuu');
  writeNote(home, 'a', { type: 'knowledge', title: 'A' });
  mint(home, 'knowledge');
  assert.equal(diffGenerations(home, 'knowledge', 1, 9).ok, false);
  rmSync(root, { recursive: true, force: true });
});

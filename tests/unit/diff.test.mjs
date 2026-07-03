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

// B1(b) (audit 2026-07-03-secrets-review.md) — belt-and-suspenders: the CLI diff
// render masks a secret-SHAPED key's value regardless of the note's `type` (the
// write door only refuses type:secret; this covers a value riding a non-secret
// change too).

test('renderNoteDiff: masks `+ value: ‹redacted›` on a CREATE (the exact leak the audit found on the CLI plan/review render)', () => {
  const out = renderNoteDiff('secrets:leaky', diffNote(null, { type: 'secret', title: 'leaky', name: 'LEAKY_KEY', value: 'sk-live-should-be-masked' }));
  assert.match(out, /\+ value: ‹redacted›/);
  assert.doesNotMatch(out, /sk-live-should-be-masked/, 'the real value never appears anywhere in the rendered diff');
});

test('renderNoteDiff: masks a secret-shaped key on a NON-secret note too (defense-in-depth — the write door only inspects type:secret)', () => {
  const out = renderNoteDiff('actions:enrich', diffNote(null, { type: 'action', title: 'enrich', api_key: 'sk-live-stray-on-an-action-note' }));
  assert.match(out, /\+ api_key: ‹redacted›/);
  assert.doesNotMatch(out, /sk-live-stray-on-an-action-note/);
});

test('renderNoteDiff: masks BOTH sides of a modify (before → after), and a remove', () => {
  const before = { type: 'secret', title: 't', token: 'sk-old-value' };
  const after = { type: 'secret', title: 't', token: 'sk-new-value' };
  const out = renderNoteDiff('secrets:x', diffNote(before, after));
  assert.match(out, /~ token: ‹redacted› → ‹redacted›/);
  assert.doesNotMatch(out, /sk-old-value|sk-new-value/);

  const removeOut = renderNoteDiff('secrets:x', diffNote({ type: 'secret', title: 't', password: 'sk-going-away' }, { type: 'secret', title: 't' }));
  assert.match(removeOut, /- password: ‹redacted›/);
  assert.doesNotMatch(removeOut, /sk-going-away/);
});

test('renderNoteDiff: a non-secret-shaped field renders its real value unchanged (the mask is precise, not a blanket redaction)', () => {
  const out = renderNoteDiff('knowledge:x', diffNote(null, { type: 'knowledge', title: 'A fact', path: 'src/app.ts' }));
  assert.match(out, /\+ path: src\/app\.ts/);
  assert.match(out, /\+ title: A fact/);
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

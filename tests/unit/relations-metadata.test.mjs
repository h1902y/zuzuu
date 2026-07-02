// edge metadata — a relation entry may be an OBJECT `{target, note?, cite?}`
// carrying per-edge commentary and a body-citation anchor. Round-trips exactly,
// indexes into link(note,cite), survives relate/unrelate and rename/merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse, serialize, edgeEntries, edgeTarget } from '../../src/notes/note.mjs';
import { backlinks, related } from '../../src/notes/index.mjs';
import { validateNote } from '../../src/notes/validate.mjs';
import { renameNote, mergeNotes } from '../../src/grow/refactor.mjs';
import { commit } from '../../src/grow/commit.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'zz-edge-'));
const put = (home, m, id, note) => {
  mkdirSync(join(home, m, 'items'), { recursive: true });
  writeFileSync(join(home, m, 'items', `${id}.md`), serialize({ id, ...note }));
};
const readRaw = (home, m, id) => readFileSync(join(home, m, 'items', `${id}.md`), 'utf8');
const readNote = (home, m, id) => parse(readRaw(home, m, id), { id }).note;

function withRepo(fn) {
  const root = tmp();
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('edgeEntries / edgeTarget: normalize scalars, objects, arrays; drop targetless', () => {
  assert.deepEqual(edgeEntries('a'), [{ target: 'a' }]);
  assert.deepEqual(edgeEntries(['a', { target: 'b', note: 'why' }]), [{ target: 'a' }, { target: 'b', note: 'why' }]);
  assert.deepEqual(edgeEntries([{ note: 'no target' }, null]), []);
  assert.equal(edgeTarget({ target: 'x', cite: 'r1' }), 'x');
  assert.equal(edgeTarget('y'), 'y');
});

test('parse ∘ serialize round-trips an object edge exactly', () => {
  const note = {
    type: 'knowledge', title: 'A',
    relations: { 'builds-on': [{ target: 'knowledge:b', note: 'extends the frame', cite: 'r1' }, 'knowledge:c'] },
    body: 'x [claim][^r1]',
  };
  const text = serialize(note);
  const { ok, note: back } = parse(text, { id: 'a' });
  assert.equal(ok, true);
  assert.deepEqual(back.relations, note.relations);
  assert.equal(serialize({ id: 'a', ...back }), text, 'byte round-trip');
});

test('index: object edges land in link(note,cite); backlinks expose them; related() walks them', () => {
  const home = tmp();
  try {
    put(home, 'knowledge', 'b', { type: 'knowledge', title: 'B' });
    put(home, 'knowledge', 'a', {
      type: 'knowledge', title: 'A',
      relations: { 'builds-on': { target: 'b', note: 'extends the frame', cite: 'r1' } },
    });
    const back = backlinks(home, 'knowledge:b');
    assert.equal(back.length, 1);
    assert.equal(back[0].addr, 'knowledge:a');
    assert.equal(back[0].note, 'extends the frame');
    assert.equal(back[0].cite, 'r1');
    const walk = related(home, 'knowledge:a', { depth: 1 });
    assert.deepEqual(walk.map((r) => r.addr), ['knowledge:b'], 'the walk resolves the object edge');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('validate: an object entry without a target is an error; with target is fine', () => {
  const bad = validateNote({ type: 'knowledge', title: 'k', status: 'active', relations: { uses: [{ note: 'floating' }] } });
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join(' '), /object entry without a target/);
  const good = validateNote({ type: 'knowledge', title: 'k', status: 'active', relations: { uses: [{ target: 'x', note: 'n' }] } });
  assert.equal(good.ok, true);
});

test('relate → unrelate round-trips bytes with an OBJECT edge; re-relate updates metadata', () => {
  withRepo((home) => {
    // floor-complete fixtures: the write boundary heals missing status on the
    // first relate, which would defeat a byte round-trip against pre-floor bytes
    put(home, 'knowledge', 'a', { type: 'knowledge', title: 'A', status: 'active', body: 'a' });
    put(home, 'knowledge', 'b', { type: 'knowledge', title: 'B', status: 'active', body: 'b' });
    const before = readRaw(home, 'knowledge', 'a');
    const edge = { target: 'knowledge:b', note: 'why', cite: 'r2' };
    let r = commit(home, {}, [{ module: 'knowledge', op: 'relate', change: { from: 'a', type: 'uses', to: edge } }]);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(readNote(home, 'knowledge', 'a').relations, { uses: edge });
    // re-relate same target with new metadata → entry replaced, not duplicated
    r = commit(home, {}, [{ module: 'knowledge', op: 'relate', change: { from: 'a', type: 'uses', to: { target: 'knowledge:b', note: 'updated' } } }]);
    assert.equal(r.ok, true);
    const rel = readNote(home, 'knowledge', 'a').relations.uses;
    assert.deepEqual([].concat(rel), [{ target: 'knowledge:b', note: 'updated' }]);
    // unrelate by target string prunes the object edge; bytes round-trip
    r = commit(home, {}, [{ module: 'knowledge', op: 'unrelate', change: { from: 'a', type: 'uses', to: 'knowledge:b' } }]);
    assert.equal(r.ok, true);
    assert.equal(readRaw(home, 'knowledge', 'a'), before, 'relate→unrelate returns to original bytes');
  });
});

test('rename repoints an object edge, keeping its metadata; merge unions by target', () => {
  withRepo((home) => {
    put(home, 'knowledge', 'old', { type: 'knowledge', title: 'Old' });
    put(home, 'knowledge', 'ref', {
      type: 'knowledge', title: 'Ref',
      relations: { uses: { target: 'knowledge:old', note: 'kept through rename', cite: 'r3' } },
    });
    const r = renameNote(home, 'knowledge', 'old', 'new');
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.refs, 1);
    assert.deepEqual(readNote(home, 'knowledge', 'ref').relations.uses,
      { target: 'knowledge:new', note: 'kept through rename', cite: 'r3' });

    // merge: src's object edge unions into dst, deduped by target
    put(home, 'knowledge', 'x', { type: 'knowledge', title: 'X', relations: { uses: { target: 'knowledge:new', note: 'from x' } }, body: 'xb' });
    put(home, 'knowledge', 'y', { type: 'knowledge', title: 'Y', relations: { uses: ['knowledge:new', 'knowledge:ref'] }, body: 'yb' });
    const m = mergeNotes(home, 'knowledge', 'x', 'y');
    assert.equal(m.ok, true, JSON.stringify(m));
    const rel = [].concat(readNote(home, 'knowledge', 'y').relations.uses);
    assert.equal(rel.length, 2, 'knowledge:new deduped by target (dst edge wins), ref kept');
    assert.ok(rel.includes('knowledge:new'), "dst's plain edge wins the clash");
    assert.ok(rel.includes('knowledge:ref'));
  });
});

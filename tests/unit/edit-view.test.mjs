// Tier 2.7 — scoped writes (patch/append) + windowed read (view).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize, parse } from '../../src/notes/note.mjs';
import { patchNote, appendNote } from '../../src/grow/edit.mjs';
import { viewNote } from '../../src/use/view.mjs';

function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-edit-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  return fn(join(root, '.zuzuu'), () => rmSync(root, { recursive: true, force: true }));
}
const put = (home, id, note) => {
  mkdirSync(join(home, 'knowledge', 'items'), { recursive: true });
  writeFileSync(join(home, 'knowledge', 'items', `${id}.md`), serialize({ id, ...note }));
};
const read = (home, id) => parse(readFileSync(join(home, 'knowledge', 'items', `${id}.md`), 'utf8'), { id }).note;

test('patch: sets one field, keeps the rest, coerces JSON', () => {
  withRepo((home, done) => {
    put(home, 'a', { type: 'knowledge', title: 'A', tags: ['x'], body: 'b' });
    assert.equal(patchNote(home, 'knowledge', 'a', 'status', 'active').ok, true);
    assert.equal(patchNote(home, 'knowledge', 'a', 'score', '5').ok, true);
    const n = read(home, 'a');
    assert.equal(n.status, 'active');
    assert.equal(n.score, 5, 'numeric value coerced');
    assert.deepEqual(n.tags, ['x'], 'untouched fields survive');
    done();
  });
});

test('patch: refuses structural keys + a missing note', () => {
  withRepo((home, done) => {
    put(home, 'a', { type: 'knowledge', title: 'A' });
    assert.equal(patchNote(home, 'knowledge', 'a', 'type', 'rule').ok, false, 'type is structural');
    assert.equal(patchNote(home, 'knowledge', 'ghost', 'x', 'y').ok, false, 'missing note');
    done();
  });
});

test('append: adds a line to the body, preserving existing', () => {
  withRepo((home, done) => {
    put(home, 'a', { type: 'knowledge', title: 'A', body: 'line 1' });
    assert.equal(appendNote(home, 'knowledge', 'a', 'line 2').ok, true);
    assert.equal(read(home, 'a').body, 'line 1\nline 2');
    done();
  });
});

test('view: windows the body with a PARTIAL notice + total', () => {
  withRepo((home, done) => {
    put(home, 'big', { type: 'knowledge', title: 'Big', body: Array.from({ length: 10 }, (_, i) => `L${i}`).join('\n') });
    const all = viewNote(home, 'knowledge', 'big');
    assert.equal(all.total, 10);
    assert.equal(all.partial, false);
    const win = viewNote(home, 'knowledge', 'big', { offset: 2, limit: 3 });
    assert.equal(win.body, 'L2\nL3\nL4');
    assert.equal(win.shown, 3);
    assert.equal(win.partial, true, 'a windowed slice is flagged PARTIAL');
    assert.equal(viewNote(home, 'knowledge', 'ghost').ok, false);
    done();
  });
});

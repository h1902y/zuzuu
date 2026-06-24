// Tier 2.6 — graph-safe refactors: rename/merge with automatic link-update.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize, parse } from '../../src/notes/note.mjs';
import { renameNote, mergeNotes, refactorField } from '../../src/grow/refactor.mjs';
import { brokenLinks } from '../../src/notes/index.mjs';

function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-refac-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  return fn(join(root, '.zuzuu'), () => rmSync(root, { recursive: true, force: true }));
}
const put = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};
const read = (home, module, id) => parse(readFileSync(join(home, module, 'items', `${id}.md`), 'utf8'), { id }).note;

test('rename: moves the note AND rewrites every inbound reference (no broken link)', () => {
  withRepo((home, done) => {
    put(home, 'knowledge', 'old', { type: 'knowledge', title: 'Old' });
    put(home, 'knowledge', 'ref', { type: 'knowledge', relations: { uses: 'knowledge:old' } });    // full addr
    put(home, 'actions', 'cross', { type: 'action', relations: { 'related-to': 'knowledge:old' } }); // cross-module
    const r = renameNote(home, 'knowledge', 'old', 'new');
    assert.equal(r.ok, true);
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'old.md')), false, 'old file gone');
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'new.md')), true, 'new file present');
    assert.equal(read(home, 'knowledge', 'ref').relations.uses, 'knowledge:new', 'same-module referrer updated');
    assert.equal(read(home, 'actions', 'cross').relations['related-to'], 'knowledge:new', 'cross-module referrer updated');
    assert.deepEqual(brokenLinks(home), [], 'no broken links after rename');
    done();
  });
});

test('rename: refuses when the target id already exists', () => {
  withRepo((home, done) => {
    put(home, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    put(home, 'knowledge', 'b', { type: 'knowledge', title: 'B' });
    assert.equal(renameNote(home, 'knowledge', 'a', 'b').ok, false);
    done();
  });
});

test('merge: appends body, re-points inbound links to the destination, deletes source', () => {
  withRepo((home, done) => {
    put(home, 'knowledge', 'src', { type: 'knowledge', title: 'Src', body: 'from src' });
    put(home, 'knowledge', 'dst', { type: 'knowledge', title: 'Dst', body: 'from dst' });
    put(home, 'knowledge', 'ref', { type: 'knowledge', relations: { uses: 'knowledge:src' } });
    const r = mergeNotes(home, 'knowledge', 'src', 'dst');
    assert.equal(r.ok, true);
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'src.md')), false, 'src deleted');
    assert.match(read(home, 'knowledge', 'dst').body, /from dst[\s\S]*from src/, 'bodies concatenated');
    assert.equal(read(home, 'knowledge', 'ref').relations.uses, 'knowledge:dst', 'referrer re-pointed to dst');
    assert.deepEqual(brokenLinks(home), [], 'no broken links after merge');
    done();
  });
});

test('refactorField: rewrites a frontmatter value across the module', () => {
  withRepo((home, done) => {
    put(home, 'guardrails', 'r1', { type: 'rule', action: 'deny' });
    put(home, 'guardrails', 'r2', { type: 'rule', action: 'ask' });
    put(home, 'guardrails', 'note', { type: 'knowledge', action: 'deny' }); // different type — untouched
    const r = refactorField(home, 'guardrails', 'type', 'rule', 'guardrail');
    assert.equal(r.ok, true);
    assert.equal(r.changed, 2, 'both rule notes rewritten, the knowledge note left alone');
    assert.equal(read(home, 'guardrails', 'r1').type, 'guardrail');
    assert.equal(read(home, 'guardrails', 'note').type, 'knowledge');
    done();
  });
});

// tests/unit/metal.test.mjs — the metal layer: git · fs · repo.
//
// Pins the contracts the Rung-2 consolidation rests on: git()'s {ok,code,out,err}
// (clean 0 / conflict 1 / fatal 128 — the discriminator the session merge probe
// needs), the metal/fs byte primitives, and the note repository round-trips.
//
// Hermetic: isolated tmp dirs + tmp git repos only — never the real .git/ or .zuzuu/.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { git, out } from '../../src/metal/git.mjs';
import { readText, writeText, remove, list, mkdirp } from '../../src/metal/fs.mjs';
import { readNote, writeNote, removeNote, listNoteIds } from '../../src/notes/repo.mjs';
import { itemPath } from '../../src/notes/store.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────

function withGitRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-metal-git-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  writeFileSync(join(root, 'a.txt'), 'one\n');
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: root });
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'zz-metal-fs-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ── metal/git: the {ok,code,out,err} contract ────────────────────────────────

test('git(): a clean call → {ok:true, code:0, out:<sha>, err:""}', () => {
  withGitRepo((root) => {
    const r = git(['rev-parse', 'HEAD'], root);
    assert.equal(r.ok, true);
    assert.equal(r.code, 0);
    assert.equal(r.out.length, 40);
    assert.equal(r.err, '');
  });
});

test('git(): merge-tree distinguishes a conflict(1) from a clean merge(0)', () => {
  withGitRepo((root) => {
    execFileSync('git', ['checkout', '-q', '-b', 'feat'], { cwd: root });
    writeFileSync(join(root, 'a.txt'), 'feat\n'); execFileSync('git', ['commit', '-qam', 'feat'], { cwd: root });
    execFileSync('git', ['checkout', '-q', 'main'], { cwd: root });
    writeFileSync(join(root, 'a.txt'), 'main\n'); execFileSync('git', ['commit', '-qam', 'main'], { cwd: root });
    const conflict = git(['merge-tree', '--write-tree', '--quiet', 'main', 'feat'], root);
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, 1, 'a conflict is exit 1 — never an error');

    execFileSync('git', ['checkout', '-q', '-b', 'feat2'], { cwd: root });
    writeFileSync(join(root, 'b.txt'), 'new\n'); execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-qam', 'b'], { cwd: root });
    execFileSync('git', ['checkout', '-q', 'main'], { cwd: root });
    const ready = git(['merge-tree', '--write-tree', '--quiet', 'main', 'feat2'], root);
    assert.equal(ready.ok, true);
    assert.equal(ready.code, 0);
  });
});

test('git(): a fatal/usage error surfaces as code 128 (never a conflict)', () => {
  const nonRepo = mkdtempSync(join(tmpdir(), 'zz-metal-nonrepo-'));
  try {
    const r = git(['rev-parse', 'HEAD'], nonRepo);
    assert.equal(r.ok, false);
    assert.equal(r.code, 128);
    assert.notEqual(r.err, '');
  } finally { rmSync(nonRepo, { recursive: true, force: true }); }
});

test('out(): trimmed stdout on success, null on any non-zero exit', () => {
  withGitRepo((root) => {
    assert.equal(out(['rev-parse', 'HEAD'], root).length, 40);
    assert.equal(out(['rev-parse', '--abbrev-ref', 'HEAD'], root), 'main');
  });
  const nonRepo = mkdtempSync(join(tmpdir(), 'zz-metal-nonrepo2-'));
  try { assert.equal(out(['rev-parse', 'HEAD'], nonRepo), null); }
  finally { rmSync(nonRepo, { recursive: true, force: true }); }
});

// ── metal/fs: the byte primitives ────────────────────────────────────────────

test('fs: writeText/readText round-trip exact bytes', () => {
  withTmp((dir) => {
    const p = join(dir, 'x.txt');
    writeText(p, 'héllo\nworld\n');
    assert.equal(readText(p), 'héllo\nworld\n');
  });
});

test('fs: mkdirp creates nested dirs (idempotent), remove deletes a file', () => {
  withTmp((dir) => {
    const nested = join(dir, 'a', 'b', 'c');
    mkdirp(nested); mkdirp(nested); // idempotent
    assert.equal(existsSync(nested), true);
    const f = join(nested, 'f.txt');
    writeText(f, 'data');
    assert.equal(existsSync(f), true);
    remove(f);
    assert.equal(existsSync(f), false);
  });
});

test('fs: list returns entry names', () => {
  withTmp((dir) => {
    writeText(join(dir, 'one.md'), 'a');
    writeText(join(dir, 'two.md'), 'b');
    assert.deepEqual(list(dir).sort(), ['one.md', 'two.md']);
  });
});

// ── notes/repo: the note repository round-trips ──────────────────────────────

const HOME = (root) => join(root, '.zuzuu');

test('repo: writeNote → readNote round-trips with id injected; listNoteIds finds it', () => {
  withTmp((root) => {
    const home = HOME(root);
    const w = writeNote(home, 'knowledge', 'fact', { type: 'knowledge', title: 'Hello', body: 'world' });
    assert.equal(w.ok, true);
    // exact bytes on disk (the serializer's contract, through the repo)
    assert.equal(readText(itemPath(home, 'knowledge', 'fact')), '---\ntype: knowledge\ntitle: Hello\n---\nworld\n');
    const note = readNote(home, 'knowledge', 'fact');
    assert.equal(note.id, 'fact', 'id injected from the filename, not frontmatter');
    assert.equal(note.title, 'Hello');
    assert.equal(note.body, 'world');
    assert.deepEqual(listNoteIds(home, 'knowledge'), ['fact']);
  });
});

test('repo: readNote → null for a falsy id or a missing file', () => {
  withTmp((root) => {
    const home = HOME(root);
    assert.equal(readNote(home, 'knowledge', null), null);
    assert.equal(readNote(home, 'knowledge', 'nope'), null);
    assert.deepEqual(listNoteIds(home, 'knowledge'), [], 'no items dir → []');
  });
});

test('repo: writeNote validates by default and refuses a malformed note', () => {
  withTmp((root) => {
    const home = HOME(root);
    const r = writeNote(home, 'guardrails', 'r1', { type: 'rule', action: 'bogus', pattern: 'rm' });
    assert.equal(r.ok, false);
    assert.match(r.error, /invalid note 'guardrails:r1'/);
    assert.equal(existsSync(itemPath(home, 'guardrails', 'r1')), false, 'nothing landed');
  });
});

test('repo: writeNote {validate:false} lands the raw bytes a schema check would reject', () => {
  withTmp((root) => {
    const home = HOME(root);
    const r = writeNote(home, 'guardrails', 'r1', { type: 'rule', action: 'bogus', pattern: 'rm' }, { validate: false });
    assert.equal(r.ok, true);
    assert.equal(readNote(home, 'guardrails', 'r1').action, 'bogus', 'the invalid value is on disk');
  });
});

test('repo: removeNote deletes the file', () => {
  withTmp((root) => {
    const home = HOME(root);
    writeNote(home, 'knowledge', 'gone', { type: 'knowledge', title: 'G' });
    assert.equal(existsSync(itemPath(home, 'knowledge', 'gone')), true);
    removeNote(home, 'knowledge', 'gone');
    assert.equal(existsSync(itemPath(home, 'knowledge', 'gone')), false);
  });
});

test('repo: an unsafe id THROWS through itemPath (the moat) — never a silent escape', () => {
  withTmp((root) => {
    const home = HOME(root);
    assert.throws(() => readNote(home, 'knowledge', '../escape'), /unsafe/);
    assert.throws(() => writeNote(home, 'knowledge', '../escape', { type: 'knowledge' }), /unsafe/);
  });
});

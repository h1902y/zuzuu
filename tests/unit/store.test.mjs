// notes/store.mjs — the filesystem chokepoint: home resolution + JSON helpers.
// (Path-segment safety `seg()`/`isSafeSegment` is covered in security.test.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot, homeDir, readJson, writeJson } from '../../src/notes/store.mjs';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

test('repoRoot: outside a git repo falls back to cwd', () => {
  const d = tmp('zz-store-nogit-');
  try { assert.equal(repoRoot(d), d); } finally { rmSync(d, { recursive: true, force: true }); }
});

test('repoRoot: from a nested subdir walks up to the git root', () => {
  const root = tmp('zz-store-git-');
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    const real = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
    const sub = join(root, 'a', 'b');
    mkdirSync(sub, { recursive: true });
    assert.equal(repoRoot(sub), real, 'resolves the repo root from any subdir');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('homeDir: the hidden .zuzuu under the root', () => {
  assert.equal(homeDir('/x/y'), join('/x/y', '.zuzuu'));
});

test('readJson: missing + corrupt both return the fallback (never throw)', () => {
  const d = tmp('zz-store-json-');
  try {
    assert.deepEqual(readJson(join(d, 'nope.json'), { fb: 1 }), { fb: 1 });
    writeFileSync(join(d, 'bad.json'), '{ not valid json');
    assert.deepEqual(readJson(join(d, 'bad.json'), { fb: 2 }), { fb: 2 });
    assert.equal(readJson(join(d, 'nope.json')), null, 'default fallback is null');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('writeJson: creates parent dirs and round-trips through readJson', () => {
  const d = tmp('zz-store-write-');
  try {
    const nested = join(d, 'deep', 'nest', 'x.json');
    writeJson(nested, { a: 1, b: ['x'] });
    assert.ok(existsSync(nested), 'mkdir -p the parents');
    assert.deepEqual(readJson(nested), { a: 1, b: ['x'] });
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// kernel/store.mjs — home resolution + module:id addressing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths, homeDir, parseAddress, itemPath, manifestPath, resolve, idFromPath } from '../../zuzuu/kernel/store.mjs';

// hermetic temp dir, outside a git repo (so repoRoot falls back to cwd)
function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'zuzuu-kernel-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('paths: home is <root>/.zuzuu with the canonical sub-paths', () => {
  withTemp((cwd) => {
    const p = paths(cwd);
    assert.equal(p.home, join(p.root, '.zuzuu'));
    assert.equal(p.index, join(p.home, 'sessions.json'));
    assert.equal(p.live, join(p.home, '.live'));
    assert.equal(p.generations, join(p.home, '.generations'));
  });
});

test('homeDir falls back to cwd outside a git repo', () => {
  withTemp((cwd) => {
    // temp dir is not a git repo → repoRoot() == cwd → home == cwd/.zuzuu
    assert.equal(homeDir(cwd), join(cwd, '.zuzuu'));
  });
});

test('parseAddress: module:id and bare id', () => {
  assert.deepEqual(parseAddress('knowledge:client-acme'), { module: 'knowledge', id: 'client-acme' });
  assert.deepEqual(parseAddress('client-acme'), { module: null, id: 'client-acme' });
});

test('itemPath / manifestPath: the layout', () => {
  const home = '/x/.zuzuu';
  assert.equal(itemPath(home, 'knowledge', 'a'), join(home, 'knowledge', 'items', 'a.md'));
  assert.equal(manifestPath(home, 'actions'), join(home, 'actions', 'module.md'));
});

test('resolve: module:id → path; bare id uses context module', () => {
  const home = '/x/.zuzuu';
  assert.equal(resolve(home, 'actions:build'), join(home, 'actions', 'items', 'build.md'));
  assert.equal(resolve(home, 'build', 'actions'), join(home, 'actions', 'items', 'build.md'));
  assert.throws(() => resolve(home, 'build'), /needs a module/);
});

test('idFromPath: stem', () => {
  assert.equal(idFromPath('/x/.zuzuu/knowledge/items/foo.md'), 'foo');
});

test('paths resolves a real .zuzuu under cwd', () => {
  withTemp((cwd) => {
    mkdirSync(join(cwd, '.zuzuu', 'knowledge', 'items'), { recursive: true });
    const p = paths(cwd);
    assert.equal(itemPath(p.home, 'knowledge', 'x'), join(cwd, '.zuzuu', 'knowledge', 'items', 'x.md'));
  });
});

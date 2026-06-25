// notes/registry-pointer.mjs — the machine-global registry pointer (active + known).
// Hermetic: each test passes an explicit temp pointer path (no global state touched).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readPointer, writePointer, setActiveRegistry, activeRegistryPath, resolveRegistryPath,
} from '../../src/notes/registry-pointer.mjs';

const ptr = () => join(mkdtempSync(join(tmpdir(), 'zz-ptr-')), 'registry.json');

test('readPointer: missing → empty, never throws', () => {
  assert.deepEqual(readPointer(ptr()), { active: null, known: {} });
});

test('readPointer: corrupt JSON → empty, never throws', () => {
  const p = ptr();
  writeFileSync(p, '{ not json');
  assert.deepEqual(readPointer(p), { active: null, known: {} });
});

test('setActiveRegistry sets active + remembers identity→path', () => {
  const p = ptr();
  setActiveRegistry('reg-abc', '/repos/my-registry', p);
  assert.equal(activeRegistryPath(p), '/repos/my-registry');
  assert.equal(resolveRegistryPath('reg-abc', p), '/repos/my-registry');
  assert.equal(resolveRegistryPath('unknown', p), null);
});

test('two known registries resolve independently; active is the latest set', () => {
  const p = ptr();
  setActiveRegistry('reg-a', '/repos/a', p);
  setActiveRegistry('reg-b', '/repos/b', p);
  assert.equal(activeRegistryPath(p), '/repos/b');
  assert.equal(resolveRegistryPath('reg-a', p), '/repos/a'); // earlier identity still resolves
  assert.equal(resolveRegistryPath('reg-b', p), '/repos/b');
});

test('writePointer normalizes shape (active null + known {})', () => {
  const p = ptr();
  writePointer({}, p);
  assert.deepEqual(readPointer(p), { active: null, known: {} });
});

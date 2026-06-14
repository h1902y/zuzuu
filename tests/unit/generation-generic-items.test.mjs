import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { moduleItemFiles } from '../../zuzuu/module/generation/read.mjs';

test('generic fallback enumerates <module>/items/*.md for composed modules', () => {
  const home = mkdtempSync(join(tmpdir(), 'zz-gen-'));
  mkdirSync(join(home, 'playbooks', 'items'), { recursive: true });
  writeFileSync(join(home, 'playbooks', 'items', 'foo.md'), '---\nid: foo\nmodule: playbooks\n---\nbody\n');
  const files = moduleItemFiles(home, 'playbooks');
  assert.equal(files.length, 1);
  assert.equal(files[0].id, 'foo');
  assert.equal(files[0].module, 'playbooks');
  assert.ok(files[0].hash);
});
test('unknown module with no dir → []', () => {
  const home = mkdtempSync(join(tmpdir(), 'zz-gen-'));
  assert.deepEqual(moduleItemFiles(home, 'nope'), []);
});

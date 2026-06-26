// U10 (root side) — readManifest surfaces an optional `fields` block (KTD5): absent ⇒
// [] (schemaless cards); present ⇒ a typed table. The tolerant parser holds it, and
// `zz module schema <key> --json` returns it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readManifest } from '../../src/notes/module.mjs';
import { serialize } from '../../src/notes/note.mjs';
import { run } from '../../src/cli/index.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

function withHome(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-fields-'));
  const home = join(cwd, '.zuzuu');
  mkdirSync(home, { recursive: true });
  resetCapabilities();
  try { return fn(home, cwd); } finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}
const manifest = (home, module, extra) => {
  mkdirSync(join(home, module), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ id: module, type: 'module', title: module, ...extra }));
};

test('readManifest surfaces a `fields` block when present', () => {
  withHome((home) => {
    const fields = [{ name: 'title', type: 'text', required: true }, { name: 'status', type: 'select' }];
    manifest(home, 'knowledge', { fields });
    assert.deepEqual(readManifest(home, 'knowledge').fields, fields);
  });
});

test('a module with no `fields` is schemaless — fields is []', () => {
  withHome((home) => {
    manifest(home, 'knowledge', {});
    assert.deepEqual(readManifest(home, 'knowledge').fields, []);
    // a totally absent manifest also yields [] (fail-soft), never undefined
    assert.deepEqual(readManifest(home, 'nope').fields, []);
  });
});

test('zz module schema <key> --json returns the fields', async () => {
  await withHome(async (home, cwd) => {
    initHome(cwd);
    manifest(home, 'knowledge', { fields: [{ name: 'title', type: 'text' }] });
    const out = [];
    await run(['module', 'schema', 'knowledge', '--json'], { cwd, log: (s) => out.push(String(s)) });
    assert.deepEqual(JSON.parse(out[0]), { key: 'knowledge', fields: [{ name: 'title', type: 'text' }] });
  });
});

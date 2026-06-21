// the programmatic façade — one handle, every verb, bound to a home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../zuzuu/kernel/item.mjs';
import { open } from '../../zuzuu/api.mjs';
import { resetCapabilities } from '../../zuzuu/capabilities/index.mjs';

function withApi(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-api-'));
  const home = join(root, '.zuzuu'); // git-citizen: open() resolves repoRoot(root)+/.zuzuu
  mkdirSync(join(home, 'knowledge', 'items'), { recursive: true });
  writeFileSync(join(home, 'knowledge', 'module.md'), serialize({ id: 'knowledge', type: 'module', title: 'knowledge', capabilities: ['query', 'check', 'enhance'] }));
  writeFileSync(join(home, 'knowledge', 'items', 'seed.md'), serialize({ id: 'seed', type: 'knowledge', title: 'a seed fact', body: 'the index works' }));
  resetCapabilities();
  try { return fn(open(root)); } finally { rmSync(root, { recursive: true, force: true }); resetCapabilities(); }
}

test('api: open() resolves the home and lists modules', () => {
  withApi((zz) => {
    assert.ok(zz.home.endsWith('.zuzuu'));
    assert.deepEqual(zz.modules().map((m) => m.id), ['knowledge']);
  });
});

test('api: query dispatches through the façade', () => {
  withApi((zz) => {
    const r = zz.query('knowledge', { text: 'index' });
    assert.equal(r.ok, true);
    assert.ok(r.value.rows.some((x) => x.addr === 'knowledge:seed'));
  });
});

test('api: propose → approve grows the brain and mints a generation', () => {
  withApi((zz) => {
    const p = zz.propose('knowledge', { op: 'create', target: 'learned', change: { type: 'knowledge', title: 'a learned fact', body: 'from a run' } });
    assert.equal(zz.approve('knowledge', p.id).ok, true);
    assert.equal(zz.generations('knowledge').active, 1);
    assert.ok(zz.query('knowledge', { text: 'learned' }).value.rows.some((x) => x.addr === 'knowledge:learned'));
  });
});

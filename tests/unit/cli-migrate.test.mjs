// rung 8e — migrate a v1 home (module.json + kind-typed items) to v2 envelopes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateHome } from '../../src/cli/migrate.mjs';
import { parse } from '../../src/kernel/item.mjs';

function withV1Home(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-mig-'));
  const home = join(cwd, '.zuzuu');
  // a minimal v1 home: module.json manifests + a kind-typed item
  mkdirSync(join(home, 'knowledge', 'items'), { recursive: true });
  writeFileSync(join(home, 'knowledge', 'module.json'), JSON.stringify({ id: 'knowledge', title: 'Knowledge', kinds: ['fact'] }));
  writeFileSync(join(home, 'knowledge', 'items', 'acme.md'), '---\nid: acme\nmodule: knowledge\nkind: fact\ntitle: Acme likes blue\n---\nBody.\n');
  try { return fn({ cwd, home }); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

test('migrate: module.json → module.md (v2 envelope); json removed', () => {
  withV1Home(({ cwd, home }) => {
    const r = migrateHome(cwd);
    assert.equal(r.migrated, true);
    assert.equal(r.modules, 1);
    assert.equal(existsSync(join(home, 'knowledge', 'module.json')), false, 'v1 manifest removed');
    const md = readFileSync(join(home, 'knowledge', 'module.md'), 'utf8');
    assert.match(md, /type: module/);
    assert.match(md, /capabilities:/);
    const { item } = parse(md, { id: 'knowledge' });
    assert.equal(item.zu_type, 'knowledge');
    assert.deepEqual(item.capabilities, ['query', 'check', 'enhance']);
  });
});

test('migrate: an item folds kind→type and drops id/module', () => {
  withV1Home(({ cwd, home }) => {
    const r = migrateHome(cwd);
    assert.equal(r.items, 1);
    const raw = readFileSync(join(home, 'knowledge', 'items', 'acme.md'), 'utf8');
    const front = raw.split('---')[1]; // the frontmatter block
    assert.match(front, /type: fact/, 'kind became type');
    assert.doesNotMatch(front, /^kind:/m, 'kind dropped');
    assert.doesNotMatch(front, /^module:/m, 'module dropped');
    assert.doesNotMatch(front, /^id:/m, 'id is the filename, not frontmatter');
    // (parse re-injects id from the filename, so check the file, not the parsed item)
    const { item } = parse(raw, { id: 'acme' });
    assert.equal(item.type, 'fact');
    assert.equal(item.title, 'Acme likes blue');
  });
});

test('migrate: idempotent — a second run is a no-op (already v2)', () => {
  withV1Home(({ cwd }) => {
    migrateHome(cwd);
    const again = migrateHome(cwd);
    assert.equal(again.migrated, false);
    assert.equal(again.alreadyV2, true);
  });
});

test('migrate: no home → reported, not thrown', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-mig-'));
  try { assert.equal(migrateHome(cwd).migrated, false); }
  finally { rmSync(cwd, { recursive: true, force: true }); }
});

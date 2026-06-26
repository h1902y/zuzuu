// U3 — the subcommand-first `module` reads the web daemon shells: overview · items
// <key> · item <key> <id> · schema <key>, each with --json (and the existing key-first
// list/generations/rollback/diff made --json-aware). Reads run on the CLI/index, not
// the daemon's degraded peek — so custom modules surface too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { serialize } from '../../src/notes/note.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { stageChange } from '../../src/grow/stage.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-modverbs-'));
  resetCapabilities();
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, home: join(cwd, '.zuzuu'), io, out }); }
  finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}
const writeNote = (home, module, id, n) => {
  ensureModuleManifest(home, module);
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...n }));
};

test('module items <key> --json → notes as id/type/title/status/body', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'knowledge', 'a', { type: 'knowledge', title: 'A', status: 'active', body: 'Alpha' });
    writeNote(home, 'knowledge', 'b', { type: 'knowledge', title: 'B', body: 'Beta' });
    out.length = 0;
    assert.equal(await run(['module', 'items', 'knowledge', '--json'], io), 0);
    assert.equal(out.length, 1, 'single JSON line');
    const res = JSON.parse(out[0]); // { items, errors } — the daemon's ModuleDetail contract
    assert.ok(Array.isArray(res.items) && Array.isArray(res.errors));
    assert.equal(res.items.length, 2);
    const a = res.items.find((x) => x.id === 'a');
    assert.deepEqual({ id: a.id, kind: a.kind, title: a.title, status: a.status, body: a.body }, { id: 'a', kind: 'knowledge', title: 'A', status: 'active', body: 'Alpha' });
  });
});

test('module item <key> <id> --json → one record; unknown id → JSON error', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'knowledge', 'a', { type: 'knowledge', title: 'A', body: 'Alpha' });
    out.length = 0;
    assert.equal(await run(['module', 'item', 'knowledge', 'a', '--json'], io), 0);
    assert.equal(JSON.parse(out[0]).id, 'a');
    out.length = 0;
    assert.equal(await run(['module', 'item', 'knowledge', 'zzz', '--json'], io), 1);
    assert.match(JSON.parse(out[0]).error, /no note 'zzz'/);
  });
});

test('module overview --json → each module with items + pending; custom modules surface', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    writeNote(home, 'knowledge', 'b', { type: 'knowledge', title: 'B' });
    stageChange(home, 'knowledge', { op: 'create', target: 'c', change: { type: 'knowledge', title: 'C' } });
    ensureModuleManifest(home, 'roadmap'); // a custom (non-standard) module
    writeNote(home, 'roadmap', 'q3', { type: 'knowledge', title: 'Q3' });
    out.length = 0;
    assert.equal(await run(['module', 'overview', '--json'], io), 0);
    const rows = JSON.parse(out[0]);
    const k = rows.find((r) => r.key === 'knowledge');
    assert.equal(k.items, 2);
    assert.equal(k.pending, 1);
    assert.ok(rows.some((r) => r.key === 'roadmap'), 'a custom module surfaces (no hardcoded ITEM_DIRS gap on the CLI path)');
    assert.ok(rows.some((r) => r.key === 'instructions'), 'the shipped instructions module is listed');
  });
});

test('module schema <key> --json → {key, fields:[]} (schemaless until U10)', async () => {
  await withRepo(async ({ io, out }) => {
    initHome(io.cwd);
    ensureModuleManifest(join(io.cwd, '.zuzuu'), 'knowledge');
    out.length = 0;
    assert.equal(await run(['module', 'schema', 'knowledge', '--json'], io), 0);
    assert.deepEqual(JSON.parse(out[0]), { key: 'knowledge', fields: [] });
  });
});

test('module list --json is json-aware (no regression to the key-first path)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    ensureModuleManifest(home, 'knowledge');
    out.length = 0;
    assert.equal(await run(['module', 'list', '--json'], io), 0);
    const rows = JSON.parse(out[0]);
    assert.ok(Array.isArray(rows));
    assert.ok(rows.some((r) => r.id === 'knowledge'));
    // and TOON still by default
    out.length = 0;
    await run(['module', 'list'], io);
    assert.match(out.join('\n'), /modules\[/);
  });
});

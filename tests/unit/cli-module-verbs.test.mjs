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
import { readManifest } from '../../src/notes/module.mjs';
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

test('module items <key> carries CUSTOM frontmatter columns (the lossless projection)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    // a note with custom columns beyond the indexed five — these round-trip on disk
    // but were truncated by the old index-row projection (the data-loss-in-view bug).
    writeNote(home, 'knowledge', 'a', { type: 'knowledge', title: 'A', status: 'active', body: 'Alpha', priority: 'high', owner: 'alice' });
    writeNote(home, 'knowledge', 'b', { type: 'knowledge', title: 'B', body: 'Beta', priority: 'low' });
    out.length = 0;
    assert.equal(await run(['module', 'items', 'knowledge', '--json'], io), 0);
    const res = JSON.parse(out[0]);
    const a = res.items.find((x) => x.id === 'a');
    // the custom columns survive end to end
    assert.equal(a.priority, 'high');
    assert.equal(a.owner, 'alice');
    assert.equal(a.kind, 'knowledge'); // type → kind (the daemon's ModuleItem shape)
    assert.equal(a.body, 'Alpha');
    // and the TOON column set unions the custom keys (minus the body/module internals)
    out.length = 0;
    assert.equal(await run(['module', 'items', 'knowledge'], io), 0);
    const header = out.join('\n').match(/items\[\d+\]\{([^}]*)\}/)[1].split(',');
    assert.deepEqual(header, ['id', 'kind', 'title', 'status', 'priority', 'owner']);
    assert.ok(!header.includes('body') && !header.includes('module'), 'body/module are not columns');
  });
});

test('module items <key> filters · sorts · paginates server-side + returns total (Rung 7)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    const mk = (id, title, status, priority) => writeNote(home, 'tasks', id, { type: 'task', title, status, priority, body: `${id} body` });
    mk('alpha', 'Alpha', 'active', 'high');
    mk('bravo', 'Bravo', 'active', 'low');
    mk('charlie', 'Charlie', 'archived', 'high');
    mk('delta', 'Delta', 'active', 'high');
    const page = async (...flags) => { out.length = 0; assert.equal(await run(['module', 'items', 'tasks', ...flags, '--json'], io), 0); return JSON.parse(out[0]); };

    // --where (EAV) + --sort (promoted) + --limit/--offset: the golden filtered, sorted, paginated page
    const r = await page('--where', 'priority=high', '--sort', 'title', '--limit', '2', '--offset', '1');
    assert.equal(r.total, 3, 'total = the pre-paginate count (the 3 high), not the 2-row page');
    assert.deepEqual(r.items.map((i) => i.id), ['charlie', 'delta']);
    assert.equal(out.length, 1, 'single JSON line — the daemon JSON.parses it');

    // each filter axis stands alone
    assert.deepEqual((await page('--type', 'task')).items.length, 4);
    assert.deepEqual((await page('--status', 'archived')).items.map((i) => i.id), ['charlie']);
    assert.deepEqual((await page('--text', 'bravo')).items.map((i) => i.id), ['bravo']);

    // an empty result is clean (no rows, total 0, errors present)
    assert.deepEqual(await page('--where', 'priority=none'), { items: [], total: 0, errors: [] });
  });
});

test('module item <key> <id> returns the FULL envelope incl. custom keys', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'knowledge', 'a', { type: 'knowledge', title: 'A', status: 'active', body: 'Alpha', priority: 'high', owner: 'alice' });
    out.length = 0;
    assert.equal(await run(['module', 'item', 'knowledge', 'a', '--json'], io), 0);
    const item = JSON.parse(out[0]);
    assert.equal(item.id, 'a');
    assert.equal(item.kind, 'knowledge');
    assert.equal(item.priority, 'high');
    assert.equal(item.owner, 'alice');
    assert.equal(item.body, 'Alpha');
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

// ── Rung 9: the module-lifecycle writes the daemon shells (module new/enable/disable,
//    gen mint) — previously NONEXISTENT verbs (the live daemon-write bug). ────────────

test('module new <id> materializes a manifest that then LISTS (the daemon-shelled creation)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    out.length = 0;
    assert.equal(await run(['module', 'new', 'recipes', '--title', 'Recipes', '--tagline', 'cook things', '--capabilities', 'query,check', '--kinds', 'note', '--required', 'body', '--json'], io), 0);
    assert.deepEqual(JSON.parse(out[0]), { ok: true, id: 'recipes' });
    // it now appears in `module list`
    out.length = 0;
    await run(['module', 'list', '--json'], io);
    assert.ok(JSON.parse(out[0]).some((r) => r.id === 'recipes'), 'the new module lists');
    // a second create refuses (additive, never clobbers)
    out.length = 0;
    assert.equal(await run(['module', 'new', 'recipes', '--json'], io), 1);
    assert.match(JSON.parse(out[0]).error, /already exists/);
  });
});

test('module enable/disable toggles the manifest enabled flag (round-trips)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    await run(['module', 'new', 'recipes', '--json'], io);
    out.length = 0;
    assert.equal(await run(['module', 'disable', 'recipes', '--json'], io), 0);
    assert.deepEqual(JSON.parse(out[0]), { ok: true, id: 'recipes', enabled: false });
    assert.equal(readManifest(home, 'recipes').enabled, false, 'disabled persisted');
    out.length = 0;
    assert.equal(await run(['module', 'enable', 'recipes', '--json'], io), 0);
    assert.equal(readManifest(home, 'recipes').enabled, true, 'enabled again (key dropped)');
  });
});

test('gen mint <m> mints a generation (the per-module freeze the daemon shells)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    await run(['module', 'new', 'recipes', '--json'], io);
    out.length = 0;
    assert.equal(await run(['gen', 'mint', 'recipes', '--json'], io), 0);
    assert.deepEqual(JSON.parse(out[0]), { id: '1', module: 'recipes', mintedFrom: [] });
    out.length = 0;
    await run(['gen', 'list', 'recipes', '--json'], io);
    assert.equal(JSON.parse(out[0]).active, 1, 'generation 1 is active');
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

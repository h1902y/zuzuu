// U2 — the `zz stage` verb: the write entry-door. A thin door over the complete
// grow/stage engine (create/update → a PENDING staged change the review gate governs).
// This is the "writes resolve to a pending proposal" semantics the workbench needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { listStaged } from '../../src/grow/stage.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-stage-'));
  resetCapabilities();
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, home: join(cwd, '.zuzuu'), io, out }); }
  finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}

test('stage create --json → a pending handle + the staged change on disk', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    out.length = 0;
    assert.equal(await run(['stage', 'knowledge', '--op', 'create', '--target', 'demo', '--field', 'type=knowledge', '--field', 'title=Demo', '--json'], io), 0);
    assert.equal(out.length, 1, 'one JSON line');
    const h = JSON.parse(out[0]);
    assert.equal(h.op, 'create');
    assert.equal(h.module, 'knowledge');
    assert.equal(h.target, 'demo');
    assert.equal(h.status, 'pending');
    assert.match(h.id, /^stg-/);
    const staged = listStaged(home, 'knowledge');
    assert.equal(staged.length, 1);
    assert.deepEqual(staged[0].change, { type: 'knowledge', title: 'Demo' }, 'repeated --field accumulated into the change body');
  });
});

test('stage is idempotent — re-staging the same change flags duplicate, no second file', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    const argv = ['stage', 'knowledge', '--op', 'create', '--target', 'demo', '--field', 'type=knowledge', '--field', 'title=Demo', '--json'];
    await run(argv, io);
    out.length = 0;
    assert.equal(await run(argv, io), 0);
    assert.equal(JSON.parse(out[0]).duplicate, true);
    assert.equal(listStaged(home, 'knowledge').length, 1, 'still one staged file (content-hash dedup)');
  });
});

test('stage --op update --target stages an update (distinct from create)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    await run(['stage', 'knowledge', '--op', 'create', '--target', 'demo', '--field', 'type=knowledge', '--json'], io);
    out.length = 0;
    assert.equal(await run(['stage', 'knowledge', '--op', 'update', '--target', 'demo', '--field', 'title=New', '--json'], io), 0);
    assert.equal(JSON.parse(out[0]).op, 'update');
    assert.equal(listStaged(home, 'knowledge').length, 2, 'create + update are distinct staged changes');
  });
});

test('stage an unknown module mints its module.md first (no prebuilt modules)', async () => {
  await withRepo(async ({ home, io }) => {
    initHome(io.cwd);
    assert.equal(existsSync(join(home, 'roadmap')), false);
    assert.equal(await run(['stage', 'roadmap', '--op', 'create', '--target', 'q3', '--field', 'type=knowledge', '--json'], io), 0);
    assert.ok(existsSync(join(home, 'roadmap', 'module.md')), 'the module materialized on first stage');
  });
});

test('stage --change <json> body works (the daemon path)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    out.length = 0;
    assert.equal(await run(['stage', 'knowledge', '--op', 'create', '--target', 'c', '--change', '{"type":"knowledge","title":"Via JSON"}', '--json'], io), 0);
    assert.equal(JSON.parse(out[0]).status, 'pending');
    assert.deepEqual(listStaged(home, 'knowledge')[0].change, { type: 'knowledge', title: 'Via JSON' });
  });
});

test('stage --op relate / unrelate → pending edge proposals (no --target needed)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    out.length = 0;
    // relate carries the edge in --change ({from,type,to}); no --target required
    assert.equal(await run(['stage', 'knowledge', '--op', 'relate', '--change', '{"from":"a","type":"related-to","to":"b"}', '--json'], io), 0);
    assert.equal(out.length, 1, 'one JSON line');
    assert.equal(JSON.parse(out[0]).op, 'relate');
    out.length = 0;
    assert.equal(await run(['stage', 'knowledge', '--op', 'unrelate', '--change', '{"from":"a","type":"related-to","to":"b"}', '--json'], io), 0);
    assert.equal(JSON.parse(out[0]).op, 'unrelate');
    assert.deepEqual(listStaged(home, 'knowledge').map((s) => s.op).sort(), ['relate', 'unrelate']);
  });
});

test('stage errors as JSON — bad op, and missing --target for create', async () => {
  await withRepo(async ({ io, out }) => {
    initHome(io.cwd);
    out.length = 0;
    assert.equal(await run(['stage', 'knowledge', '--op', 'bogus', '--target', 'x', '--json'], io), 1);
    assert.match(JSON.parse(out[0]).error, /invalid op/);
    out.length = 0;
    assert.equal(await run(['stage', 'knowledge', '--op', 'create', '--json'], io), 1);
    assert.match(JSON.parse(out[0]).error, /--target/);
  });
});

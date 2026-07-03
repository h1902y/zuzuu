// §I rung 2 — the `zz observe-runs` verb: the CLI door onto grow/runs-miner.mjs.
// A thin door (mirrors `zz observe`'s row) — the engine itself is exercised in full
// in tests/unit/runs-miner.test.mjs; this pins the CLI plumbing (single JSON emit,
// argv → opts mapping, --dry-run wiring).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';
import { logRun } from '../../src/notes/log.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { listStaged } from '../../src/grow/stage.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-observe-runs-cli-'));
  resetCapabilities();
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, home: join(cwd, '.zuzuu'), io, out }); }
  finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}

function seedFailures(home, module, note, n) {
  for (let i = 0; i < n; i++) logRun(home, module, note, { exitCode: 1, success: false, actor: 'agent' });
}

test('CLI: `zz observe-runs <module> --json` mines + stages, one JSON line', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    ensureModuleManifest(home, 'actions');
    seedFailures(home, 'actions', 'cli-broken', 3);
    out.length = 0;
    const code = await run(['observe-runs', 'actions', '--json'], io);
    assert.equal(code, 0);
    assert.equal(out.length, 1, 'single JSON emit, daemon-safe');
    const doc = JSON.parse(out[0]);
    assert.equal(doc.flagged, 1);
    assert.equal(doc.proposed, 1);
    assert.equal(doc.staged.length, 1);
    assert.equal(listStaged(home, 'actions').length, 1);
  });
});

test('CLI: `zz observe-runs <module> --dry-run --json` stages nothing', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    ensureModuleManifest(home, 'actions');
    seedFailures(home, 'actions', 'cli-preview', 3);
    out.length = 0;
    const code = await run(['observe-runs', 'actions', '--dry-run', '--json'], io);
    assert.equal(code, 0);
    const doc = JSON.parse(out[0]);
    assert.equal(doc.dryRun, true);
    assert.equal(doc.proposed, 0);
    assert.equal(doc.staged.length, 0);
    assert.equal(listStaged(home, 'actions').length, 0);
  });
});

test('CLI: `zz observe-runs` (no module) mines across the whole Project', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    ensureModuleManifest(home, 'actions');
    seedFailures(home, 'actions', 'cli-broad', 3);
    out.length = 0;
    const code = await run(['observe-runs', '--json'], io);
    assert.equal(code, 0);
    const doc = JSON.parse(out[0]);
    assert.equal(doc.flagged, 1);
    assert.equal(doc.proposed, 1);
  });
});

test('CLI: human mode (no --json) prints TOON, still one document underneath', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    ensureModuleManifest(home, 'actions');
    seedFailures(home, 'actions', 'cli-human', 3);
    out.length = 0;
    const code = await run(['observe-runs', 'actions'], io);
    assert.equal(code, 0);
    assert.match(out[0], /observe-runs\[1\]/);
    assert.ok(out.some((l) => l.includes('staged')), 'the staged table prints in human mode');
  });
});

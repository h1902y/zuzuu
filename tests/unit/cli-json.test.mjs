// U1 — the `--json` output mode. The web daemon shells `zz <verb> --json` and
// JSON.parses stdout, so the daemon-shelled verbs must emit a SINGLE parseable
// JSON line under --json (no second line — e.g. the post-write integrity nudge —
// or the daemon's JSON.parse breaks), while TOON stays the default (no regression).
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
import { mint } from '../../src/notes/generation.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-clijson-'));
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

test('module generations --json → a single parseable {active, generations}', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'knowledge', 'fact', { type: 'knowledge', title: 'Fact' });
    mint(home, 'knowledge'); // gen 1 — the ledger advances even outside a git repo
    out.length = 0;
    assert.equal(await run(['module', 'knowledge', 'generations', '--json'], io), 0);
    assert.equal(out.length, 1, 'exactly one line — JSON.parse-safe');
    const parsed = JSON.parse(out[0]);
    assert.equal(parsed.active, 1);
    assert.equal(parsed.generations.length, 1);
    assert.equal(parsed.generations[0].n, 1);
  });
});

test('module generations WITHOUT --json still emits TOON (no regression)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'knowledge', 'fact', { type: 'knowledge', title: 'Fact' });
    mint(home, 'knowledge');
    out.length = 0;
    assert.equal(await run(['module', 'knowledge', 'generations'], io), 0);
    const text = out.join('\n');
    assert.match(text, /generations\[/, 'TOON header present by default');
    assert.throws(() => JSON.parse(text), 'default output is not JSON');
  });
});

test('review --json → a JSON array of pending changes', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    stageChange(home, 'knowledge', { op: 'create', target: 'fact-x', change: { type: 'knowledge', title: 'Fact X', body: 'hi' } });
    out.length = 0;
    assert.equal(await run(['review', '--json'], io), 0);
    assert.equal(out.length, 1);
    const rows = JSON.parse(out[0]);
    assert.ok(Array.isArray(rows));
    assert.ok(rows.some((r) => r.module === 'knowledge' && r.id === 'fact-x'), 'the staged change is listed');
  });
});

test('review approve --json → ONE json line (integrity nudge suppressed) + approves', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    stageChange(home, 'knowledge', { op: 'create', target: 'fact-x', change: { type: 'knowledge', title: 'Fact X', body: 'hi' } });
    out.length = 0;
    assert.equal(await run(['review', 'approve', 'knowledge', 'fact-x', '--json'], io), 0);
    assert.equal(out.length, 1, 'exactly one line — the integrity nudge must be suppressed under --json');
    assert.deepEqual(JSON.parse(out[0]), { action: 'approve', module: 'knowledge', id: 'fact-x', ok: true });
  });
});

test('review approve --json on an unknown id → JSON {ok:false, error}', async () => {
  await withRepo(async ({ io, out }) => {
    initHome(io.cwd);
    ensureModuleManifest(join(io.cwd, '.zuzuu'), 'knowledge');
    out.length = 0;
    assert.equal(await run(['review', 'approve', 'knowledge', 'nope', '--json'], io), 1);
    assert.equal(out.length, 1);
    const parsed = JSON.parse(out[0]);
    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /no pending staged change/);
  });
});

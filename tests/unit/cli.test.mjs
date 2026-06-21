// rung 7 — the CLI veneer + v2 init. Drives the router the way the bin does:
// run(argv, {cwd, log}) → exit code + captured output. Hermetic (a temp non-git
// dir; repoRoot falls back to cwd). observe/enhance are covered by observe.test
// (they sweep the real ~/.claude) and are not exercised here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { serialize } from '../../src/notes/note.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-cli-'));
  resetCapabilities();
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, io, out, text: () => out.join('\n') }); }
  finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}
const zu = (cwd, module, id, item) => {
  mkdirSync(join(cwd, '.zuzuu', module, 'items'), { recursive: true });
  writeFileSync(join(cwd, '.zuzuu', module, 'items', `${id}.md`), serialize({ id, ...item }));
};

// ── init ─────────────────────────────────────────────────────────────────────

test('init: scaffolds the five modules + seed rules; idempotent', async () => {
  await withRepo(({ cwd }) => {
    const r = initHome(cwd);
    assert.equal(r.ok, true);
    for (const m of ['knowledge', 'memory', 'actions', 'instructions', 'guardrails']) {
      assert.ok(existsSync(join(cwd, '.zuzuu', m, 'module.md')), `${m}/module.md exists`);
    }
    assert.ok(existsSync(join(cwd, '.zuzuu', 'guardrails', 'items', 'no-root-wipe.md')), 'seed rule planted');
    // the rule round-trips as a real rule zu
    const rule = readFileSync(join(cwd, '.zuzuu', 'guardrails', 'items', 'no-root-wipe.md'), 'utf8');
    assert.match(rule, /type: rule/);
    assert.match(rule, /action: deny/);
    // idempotent — a second init clobbers nothing
    const r2 = initHome(cwd);
    assert.equal(r2.created.length, 0);
    assert.ok(r2.skipped.length >= 9);
  });
});

test('init: writes gitignore lines and is git-citizen (no .git created)', async () => {
  await withRepo(({ cwd }) => {
    initHome(cwd);
    assert.equal(existsSync(join(cwd, '.git')), false, 'never git init');
    assert.match(readFileSync(join(cwd, '.gitignore'), 'utf8'), /\.zuzuu\/\.live\//);
  });
});

// ── router ───────────────────────────────────────────────────────────────────

test('run: init then module list shows the five modules', async () => {
  await withRepo(async ({ io, text }) => {
    assert.equal(await run(['init'], io), 0);
    assert.equal(await run(['module', 'list'], io), 0);
    for (const m of ['knowledge', 'actions', 'guardrails']) assert.match(text(), new RegExp(m));
  });
});

test('run: query renders TOON rows; a runnable zu acts', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    await run(['init'], io);
    zu(cwd, 'knowledge', 'acme', { type: 'knowledge', title: 'Acme likes blue', body: 'blue decks' });
    zu(cwd, 'actions', 'hi', { type: 'action', title: 'say hi', run: 'echo hi-there' });
    out.length = 0;
    assert.equal(await run(['query', 'knowledge', 'blue'], io), 0);
    assert.match(out.join('\n'), /knowledge:acme/);
    out.length = 0;
    assert.equal(await run(['act', 'actions', 'hi'], io), 0);
    assert.match(out.join('\n'), /hi-there/);
  });
});

test('run: a denied verb / bad usage returns a structured error + nonzero', async () => {
  await withRepo(async ({ io, out }) => {
    await run(['init'], io);
    out.length = 0;
    assert.equal(await run(['act', 'actions'], io), 1); // missing id
    assert.match(out.join('\n'), /error\[1\]/);
  });
});

test('run: review approve applies a proposal by its human handle', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    await run(['init'], io);
    // stage a proposal directly, then drive the gate through the CLI
    const { createProposal } = await import('../../src/loop/propose.mjs');
    createProposal(join(cwd, '.zuzuu'), 'knowledge', { op: 'create', target: 'learned-fact', change: { type: 'knowledge', title: 'a learned fact', body: 'x' } });
    out.length = 0;
    assert.equal(await run(['review'], io), 0);
    assert.match(out.join('\n'), /learned-fact/);
    out.length = 0;
    assert.equal(await run(['review', 'approve', 'knowledge', 'learned-fact'], io), 0);
    out.length = 0;
    await run(['query', 'knowledge', 'learned'], io);
    assert.match(out.join('\n'), /knowledge:learned-fact/, 'approved zu is now queryable');
  });
});

test('run: check reports integrity per module; digest summarizes the brain', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    await run(['init'], io);
    zu(cwd, 'knowledge', 'dangling', { type: 'knowledge', title: 'x', relations: { 'related-to': 'knowledge:ghost' } });
    out.length = 0;
    assert.equal(await run(['check'], io), 0);
    assert.match(out.join('\n'), /integrity/);
    out.length = 0;
    assert.equal(await run(['digest'], io), 0);
    assert.match(out.join('\n'), /session brief/);
  });
});

// U4's `zz tick [--once]` + `zz daemon` — docs/plans/2026-07-06-001-feat-wake-source-
// tick-plan.md. Exercises the router end-to-end (delegates straight to grow/tick.mjs,
// already covered in depth by tests/unit/tick.test.mjs) and the dedicated in-process
// tick host (src/cli/daemon.mjs). Mirrors tests/unit/run-cli.test.mjs's fixture style.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { homeDir } from '../../src/notes/store.mjs';
import { createNote } from '../../src/grow/edit.mjs';
import { runDaemon } from '../../src/cli/daemon.mjs';
import { gateWriteVerbPattern, writeVerbPaths, COMMANDS } from '../../src/cli/commands.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-tick-cli-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 't'], { cwd });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, home: homeDir(cwd), io, out }); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

const cronExprFor = (date) => `${date.getMinutes()} ${date.getHours()} * * *`;

// ════════════════════════════════════════════════════════════════════════════
// zz tick --once: delegates to grow/tick.mjs's tick() — opt-in gated, R1/R2
// ════════════════════════════════════════════════════════════════════════════

test('zz tick --once: opt-in ON + a due enabled cron trigger fires it (delegates to grow/tick.mjs)', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 't1', {
      type: 'trigger', title: 'T1', on: { kind: 'cron', expr: cronExprFor(new Date()) }, run: 'actions:flow', enabled: true,
    });

    out.length = 0;
    await run(['autonomy', 'on', '--json'], io);

    out.length = 0;
    const code = await run(['tick', '--once', '--json'], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(out[0]);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.fired.length, 1);
    assert.match(parsed.fired[0].runId, /^flow-/);
    assert.equal(parsed.denied.length, 0);
  });
});

test('zz tick --once: opt-in OFF fires nothing, even with a due enabled trigger present', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 't1', {
      type: 'trigger', title: 'T1', on: { kind: 'cron', expr: cronExprFor(new Date()) }, run: 'actions:flow', enabled: true,
    });

    out.length = 0;
    const code = await run(['tick', '--once', '--json'], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(out[0]);
    assert.deepEqual(parsed.fired, []);
    assert.deepEqual(parsed.skipped, []);
    assert.deepEqual(parsed.denied, []);
  });
});

test('zz tick: TOON output (no --json) still names the fired/skipped/denied counts', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    out.length = 0;
    const code = await run(['tick'], io);
    assert.equal(code, 0);
    assert.match(out.join('\n'), /fired/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// the moat: `tick` and `daemon` are write/admin verbs an agent can never shell
// ════════════════════════════════════════════════════════════════════════════

test('`zz tick` and `zz daemon` are permission write/admin, agentInvokable:false, and land in writeVerbPaths()', () => {
  const tickRow = COMMANDS.find((c) => !c.alias && c.path.join(' ') === 'tick');
  const daemonRow = COMMANDS.find((c) => !c.alias && c.path.join(' ') === 'daemon');
  assert.ok(tickRow && daemonRow, 'both rows are registered in COMMANDS');
  assert.equal(tickRow.permission, 'write');
  assert.equal(tickRow.agentInvokable, false);
  assert.equal(daemonRow.permission, 'admin');
  assert.equal(daemonRow.agentInvokable, false);

  const paths = writeVerbPaths().map((p) => p.join(' '));
  assert.ok(paths.includes('tick'));
  assert.ok(paths.includes('daemon'));
});

test('the execution gate denies `zz tick`/`zz daemon` to an agent shelling zz', () => {
  const re = new RegExp(gateWriteVerbPattern(), 'i');
  assert.ok(re.test('zz tick --once'));
  assert.ok(re.test('zz daemon --interval 5000'));
  // a read stays open (sanity — the full read/write matrix lives in autonomy-cli.test.mjs)
  assert.equal(re.test('zz trigger list'), false);
});

// ════════════════════════════════════════════════════════════════════════════
// zz daemon: the dedicated in-process tick host (src/cli/daemon.mjs)
// ════════════════════════════════════════════════════════════════════════════

// a minimal fake `process` — just enough surface for runDaemon's SIGINT/SIGTERM hooks,
// so this test never touches the real process's signal handlers.
function fakeProc() {
  const handlers = {};
  return {
    once: (event, cb) => { (handlers[event] ??= []).push(cb); },
    fire: (event) => { for (const cb of handlers[event] ?? []) cb(); },
  };
}

test('runDaemon: ticks immediately on start, then shuts down cleanly on SIGINT (never a real 30s interval, never a real signal)', async () => {
  await withRepo(async ({ cwd, home, io }) => {
    initHome(cwd);
    await run(['autonomy', 'on', '--json'], io);

    const proc = fakeProc();
    const ticks = [];
    const logs = [];
    const p = runDaemon(home, { intervalMs: 10_000_000, log: (s) => logs.push(s), onTick: (r) => ticks.push(r), proc });
    // the immediate first tick runs SYNCHRONOUSLY inside the Promise executor — no await needed yet
    assert.equal(ticks.length, 1, 'ticked once immediately on start');

    proc.fire('SIGINT');
    const code = await p;
    assert.equal(code, 0);
    assert.ok(logs.some((l) => /SIGINT/.test(l)), 'the shutdown reason is logged');
  });
});

test('runDaemon: SIGTERM shuts down just as cleanly as SIGINT', async () => {
  await withRepo(async ({ cwd, home, io }) => {
    initHome(cwd);
    await run(['autonomy', 'off', '--json'], io); // opt-in OFF is fine too — the daemon loop itself doesn't care

    const proc = fakeProc();
    const p = runDaemon(home, { intervalMs: 10_000_000, log: () => {}, proc });
    proc.fire('SIGTERM');
    assert.equal(await p, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// discoverability
// ════════════════════════════════════════════════════════════════════════════

test('`tick` and `daemon` are discoverable in `zz help`', async () => {
  await withRepo(async ({ io, out }) => {
    out.length = 0;
    await run(['help'], io);
    const help = out.join('\n');
    assert.ok(help.includes('tick'));
    assert.ok(help.includes('daemon'));
  });
});

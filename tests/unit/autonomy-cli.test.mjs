// U4's founder-facing switch — `zz autonomy on|off|status`. Exercises the router
// end-to-end (argv parsing, --json single-document discipline, the operator-only
// write door) and the moat's exec-deny derivation for the three new write verbs
// (`autonomy on|off`, `tick`, `daemon`). Mirrors tests/unit/trigger-cli.test.mjs's
// fixture style; tests/unit/tick.test.mjs covers grow/tick.mjs's core directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { homeDir } from '../../src/notes/store.mjs';
import { readNote } from '../../src/notes/repo.mjs';
import { setAutonomyEnabled, isAutonomyEnabled, AUTONOMY_MODULE, AUTONOMY_ID } from '../../src/grow/autonomy.mjs';
import { doctorReport } from '../../src/cli/doctor.mjs';
import { gateWriteVerbPattern, writeVerbPaths } from '../../src/cli/commands.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-autonomy-cli-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 't'], { cwd });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, home: homeDir(cwd), io, out }); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

// ════════════════════════════════════════════════════════════════════════════
// zz autonomy on|off|status — round-trips through the CLI
// ════════════════════════════════════════════════════════════════════════════

test('zz autonomy on: flips the switch ON; zz autonomy status reports it', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    assert.equal(isAutonomyEnabled(home), false, 'off by default — no note yet');

    out.length = 0;
    let code = await run(['autonomy', 'on', '--json'], io);
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out[0]), { ok: true, autonomy_enabled: true });
    assert.equal(isAutonomyEnabled(home), true);
    assert.equal(readNote(home, AUTONOMY_MODULE, AUTONOMY_ID).type, 'autonomy');

    out.length = 0;
    code = await run(['autonomy', 'status', '--json'], io);
    assert.equal(code, 0);
    const status = JSON.parse(out[0]);
    assert.equal(status.ok, true);
    assert.equal(status.enabled, true);
  });
});

test('zz autonomy off: flips an already-on switch back OFF', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    await run(['autonomy', 'on', '--json'], io);
    assert.equal(isAutonomyEnabled(home), true);

    out.length = 0;
    const code = await run(['autonomy', 'off', '--json'], io);
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out[0]), { ok: true, autonomy_enabled: false });
    assert.equal(isAutonomyEnabled(home), false);
  });
});

test('zz autonomy status: reports OFF (and no last-tick) on a fresh project — never throws', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    out.length = 0;
    const code = await run(['autonomy', 'status', '--json'], io);
    assert.equal(code, 0);
    const status = JSON.parse(out[0]);
    assert.equal(status.enabled, false);
    assert.equal(status.lastTick, null);
  });
});

test('zz autonomy status: after a tick has run, surfaces the last fired/skipped/denied counts', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    await run(['autonomy', 'on', '--json'], io);
    out.length = 0;
    await run(['tick', '--json'], io); // opt-in ON, no triggers — a real tick still runs + logs
    out.length = 0;
    const code = await run(['autonomy', 'status', '--json'], io);
    assert.equal(code, 0);
    const status = JSON.parse(out[0]);
    assert.equal(status.enabled, true);
    assert.ok(status.lastTick, 'a tick-log entry landed');
    assert.equal(typeof status.lastTick.fired, 'number');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// the write door: a non-operator actor is refused (the flag write is gated exactly
// like every other durable mutation — commit() refuses before anything is written)
// ════════════════════════════════════════════════════════════════════════════

test('setAutonomyEnabled: refused for a non-operator actor — on a FRESH project (note absent, would-be create)', async () => {
  await withRepo(async ({ cwd, home }) => {
    initHome(cwd);
    const r = setAutonomyEnabled(home, true, 'agent');
    assert.equal(r.ok, false);
    assert.equal(r.refused, true);
    assert.equal(isAutonomyEnabled(home), false, 'nothing was written');
  });
});

test('setAutonomyEnabled: refused for a non-operator actor — on an EXISTING autonomy note (would-be patch)', async () => {
  await withRepo(async ({ cwd, home }) => {
    initHome(cwd);
    const seeded = setAutonomyEnabled(home, true, 'operator');
    assert.equal(seeded.ok, true);

    const r = setAutonomyEnabled(home, false, 'agent');
    assert.equal(r.ok, false);
    assert.equal(r.refused, true);
    assert.equal(isAutonomyEnabled(home), true, 'the prior operator-written value is untouched');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// the moat: autonomy on|off, tick, and daemon are all in the exec-deny set;
// autonomy status and trigger list are NOT (R1/R6/R8's own acceptance criteria)
// ════════════════════════════════════════════════════════════════════════════

test('writeVerbPaths(): autonomy on|off, tick, daemon land in the deny set; autonomy status does not', () => {
  const paths = writeVerbPaths().map((p) => p.join(' '));
  for (const denied of ['autonomy on', 'autonomy off', 'tick', 'daemon']) {
    assert.ok(paths.includes(denied), `writeVerbPaths() must include '${denied}'`);
  }
  assert.equal(paths.includes('autonomy status'), false, "'autonomy status' is a read — must stay OFF the deny set");
});

test('the execution gate denies `zz autonomy on|off`, `zz tick`, `zz daemon` to an agent shelling zz — reads stay open', () => {
  const re = new RegExp(gateWriteVerbPattern(), 'i');
  assert.ok(re.test('zz autonomy on'), "'zz autonomy on' is denied");
  assert.ok(re.test('zz autonomy off'), "'zz autonomy off' is denied");
  assert.ok(re.test('zz tick'), "'zz tick --once' is denied");
  assert.ok(re.test('zz tick --once'));
  assert.ok(re.test('zz daemon'), "'zz daemon' is denied");
  assert.ok(re.test('zuzuu.mjs autonomy on'), 'the zuzuu/zuzuu.mjs binary shapes are covered too');

  // reads stay open to the agent
  assert.equal(re.test('zz autonomy status'), false);
  assert.equal(re.test('zz trigger list'), false);
});

test('zz init seeds protect-brain-exec covering the new write verbs; zz doctor reports no staleness', async () => {
  await withRepo(async ({ cwd }) => {
    initHome(cwd);
    const rule = readNote(homeDir(cwd), 'instructions', 'protect-brain-exec');
    assert.ok(rule, 'the exec-deny rule note was seeded');
    assert.equal(rule.pattern, gateWriteVerbPattern(), 'the seeded pattern already covers the new write verbs (generated fresh from COMMANDS)');
    const re = new RegExp(rule.pattern, 'i');
    assert.ok(re.test('zz autonomy on') && re.test('zz tick') && re.test('zz daemon'));

    const report = doctorReport(cwd);
    assert.ok(!report.warnings.some((w) => /protect-brain-exec/.test(w)), `doctor must not flag staleness: ${JSON.stringify(report.warnings)}`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// discoverability
// ════════════════════════════════════════════════════════════════════════════

test('the `autonomy` verbs and `tick`/`daemon` are discoverable in `zz help`', async () => {
  await withRepo(async ({ io, out }) => {
    out.length = 0;
    await run(['help'], io);
    const help = out.join('\n');
    for (const line of ['autonomy on', 'autonomy off', 'autonomy status', 'tick', 'daemon']) {
      assert.ok(help.includes(line), `help lists '${line}'`);
    }
  });
});

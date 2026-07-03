// §I rung 4's CLI door — `zz trigger list|show|fire|enable|disable`. Exercises the
// router end-to-end (argv parsing, --json single-document discipline, the operator-
// only gate) — tests/unit/trigger.test.mjs covers grow/trigger.mjs's primitives.
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
import { readNote } from '../../src/notes/repo.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-trigger-cli-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 't'], { cwd });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
  const out = [];
  const warn = [];
  const io = { cwd, log: (s) => out.push(String(s)), warn: (s) => warn.push(String(s)) };
  try { return await fn({ cwd, home: homeDir(cwd), io, out, warn }); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

test('zz trigger list --json: every trigger note, any module, with enabled + blast-radius', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 't1', { type: 'trigger', title: 'T1', on: { kind: 'manual' }, run: 'actions:flow', enabled: true });

    out.length = 0;
    const code = await run(['trigger', 'list', '--json'], io);
    assert.equal(code, 0);
    assert.equal(out.length, 1, 'single JSON line');
    const { triggers } = JSON.parse(out[0]);
    assert.equal(triggers.length, 1);
    assert.equal(triggers[0].addr, 'actions:t1');
    assert.equal(triggers[0].enabled, true);

    out.length = 0;
    await run(['trigger', 'list'], io);
    assert.match(out.join('\n'), /actions:t1/);
  });
});

test('zz trigger show <module:id>: the note + blast-radius preview', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 'lead-1', { type: 'lead', title: 'l1', tier: 3 });
    createNote(home, 'crm', 'watch', {
      type: 'trigger', title: 'Watch', run: 'actions:flow', enabled: true,
      on: { kind: 'note-change', module: 'actions', event: 'update', where: ['tier>=2'] },
    });
    out.length = 0;
    const code = await run(['trigger', 'show', 'crm:watch', '--json'], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(out[0]);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.matches.count, 1);
    assert.deepEqual(parsed.matches.sample, ['actions:lead-1']);
  });
});

test('zz trigger show: an unknown addr is a structured error, exit 1', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    out.length = 0;
    const code = await run(['trigger', 'show', 'actions:ghost', '--json'], io);
    assert.equal(code, 1);
    assert.match(JSON.parse(out[0]).error, /no note/);
  });
});

test('zz trigger fire: starts a durable run, prints the next command', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 't1', { type: 'trigger', title: 'T1', on: { kind: 'manual' }, run: 'actions:flow', enabled: true });

    out.length = 0;
    const code = await run(['trigger', 'fire', 'actions:t1'], io);
    assert.equal(code, 0);
    assert.match(out.join('\n'), /flow-/);
    assert.match(out.join('\n'), /zz run advance/);

    out.length = 0;
    await run(['trigger', 'fire', 'actions:t1', '--json'], io);
    const parsed = JSON.parse(out[0]);
    assert.equal(parsed.ok, true);
    assert.match(parsed.runId, /^flow-/);
  });
});

test('zz trigger fire --dry-run: previews without starting anything', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 't1', { type: 'trigger', title: 'T1', on: { kind: 'manual' }, run: 'actions:flow', enabled: true });

    out.length = 0;
    const code = await run(['trigger', 'fire', 'actions:t1', '--dry-run', '--json'], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(out[0]);
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.runId, undefined);
    assert.equal(parsed.wouldFire, 'actions:flow');
  });
});

test('zz trigger fire: refuses a disabled trigger (exit 1), --force overrides', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 't1', { type: 'trigger', title: 'T1', on: { kind: 'manual' }, run: 'actions:flow', enabled: false });

    out.length = 0;
    let code = await run(['trigger', 'fire', 'actions:t1', '--json'], io);
    assert.equal(code, 1);
    assert.match(JSON.parse(out[0]).error, /disabled/);

    out.length = 0;
    code = await run(['trigger', 'fire', 'actions:t1', '--force', '--json'], io);
    assert.equal(code, 0);
    assert.match(JSON.parse(out[0]).runId, /^flow-/);
  });
});

test('zz trigger enable / disable: round-trips + the daemon-facing --json shape', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 't1', { type: 'trigger', title: 'T1', on: { kind: 'manual' }, run: 'actions:flow', enabled: false });

    out.length = 0;
    let code = await run(['trigger', 'enable', 'actions:t1', '--json'], io);
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out[0]), { ok: true, addr: 'actions:t1', enabled: true });
    assert.equal(readNote(home, 'actions', 't1').enabled, true);

    out.length = 0;
    code = await run(['trigger', 'disable', 'actions:t1', '--json'], io);
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out[0]), { ok: true, addr: 'actions:t1', enabled: false });
    assert.equal(readNote(home, 'actions', 't1').enabled, false);
  });
});

test('zz trigger enable: an unknown addr is a structured error', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    out.length = 0;
    const code = await run(['trigger', 'enable', 'actions:ghost', '--json'], io);
    assert.equal(code, 1);
    assert.match(JSON.parse(out[0]).error, /no note/);
  });
});

// ── the moat: an agent cannot fire/enable/disable directly; it must PROPOSE ──────────

test('the execution gate denies `zz trigger fire|enable|disable` to an agent actor (agentInvokable:false)', async () => {
  await withRepo(async ({ cwd }) => {
    const { gateWriteVerbPattern } = await import('../../src/cli/commands.mjs');
    const re = new RegExp(gateWriteVerbPattern(), 'i');
    assert.ok(re.test('zz trigger fire actions:t1'));
    assert.ok(re.test('zz trigger enable actions:t1'));
    assert.ok(re.test('zz trigger disable actions:t1'));
    // reads stay open to the agent
    assert.equal(re.test('zz trigger list'), false);
    assert.equal(re.test('zz trigger show actions:t1'), false);
  });
});

// ── an agent PROPOSES a trigger — the sanctioned channel (stage → review) ───────────

test('agent-proposes-trigger: zz stage --change <json> → zz review approve lands a valid trigger', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });

    out.length = 0;
    const change = JSON.stringify({
      type: 'trigger', title: 'Watch hot leads', run: 'actions:flow',
      on: { kind: 'note-change', module: 'actions', event: 'update', where: ['tier>=2'] },
    });
    let code = await run(['stage', 'crm', '--op', 'create', '--target', 'watch-leads', '--change', change, '--json'], io);
    assert.equal(code, 0);
    const staged = JSON.parse(out[0]);
    assert.equal(staged.status, 'pending');
    assert.equal(readNote(home, 'crm', 'watch-leads'), null, 'nothing lands until review approves it');

    out.length = 0;
    code = await run(['review', 'approve', 'crm', 'watch-leads', '--json'], io);
    assert.equal(code, 0);
    assert.equal(JSON.parse(out[0]).ok, true);

    const landed = readNote(home, 'crm', 'watch-leads');
    assert.equal(landed.type, 'trigger');
    assert.equal(landed.on.kind, 'note-change');
    // no `enabled` was proposed — the second gate defaults OFF (a reviewed-in trigger
    // isn't automatically live, §I.4 #7)
    out.length = 0;
    await run(['trigger', 'show', 'crm:watch-leads', '--json'], io);
    assert.equal(JSON.parse(out[0]).enabled, false);
  });
});

test('agent-proposes-trigger: a MALFORMED proposal is refused AT REVIEW, not silently accepted', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    out.length = 0;
    const change = JSON.stringify({ type: 'trigger', title: 'Bad', on: { kind: 'not-a-real-kind' }, run: 'actions:flow' });
    await run(['stage', 'crm', '--op', 'create', '--target', 'bad-trigger', '--change', change, '--json'], io);

    out.length = 0;
    const code = await run(['review', 'approve', 'crm', 'bad-trigger', '--json'], io);
    assert.equal(code, 1);
    assert.match(JSON.parse(out[0]).error, /on\.kind/);
    assert.equal(readNote(home, 'crm', 'bad-trigger'), null, 'the gate refused it — nothing landed');
  });
});

test('the `trigger` namespace is discoverable in `zz help`', async () => {
  await withRepo(async ({ io, out }) => {
    out.length = 0;
    await run(['help'], io);
    const help = out.join('\n');
    for (const line of ['trigger list', 'trigger show', 'trigger fire', 'trigger enable', 'trigger disable']) {
      assert.ok(help.includes(line), `help lists '${line}'`);
    }
  });
});

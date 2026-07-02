// The Tier-2 durable runner's CLI door (src/cli/verbs/run.mjs) — `zz run
// start|advance|signal|complete`. Exercises the router end-to-end (not just the
// grow/run.mjs primitives — tests/unit/run.test.mjs covers those in depth): argv
// parsing (including the `--all`-before-id footgun `query --all` already worked
// around), --json single-line-document discipline, and the operator-only gate.
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
  const cwd = mkdtempSync(join(tmpdir(), 'zz-run-cli-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 't'], { cwd });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, home: homeDir(cwd), io, out }); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

test('zz run start: materializes a run note, --json emits one document, TOON hints the next command', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });

    out.length = 0;
    const code = await run(['run', 'start', 'actions:flow'], io);
    assert.equal(code, 0);
    assert.match(out.join('\n'), /actions:flow/);
    assert.match(out.join('\n'), /zz run advance/);

    out.length = 0;
    await run(['run', 'start', 'actions:flow', '--json'], io);
    assert.equal(out.length, 1, 'single JSON line');
    const parsed = JSON.parse(out[0]);
    assert.equal(parsed.ok, true);
    assert.match(parsed.runId, /^flow-/);
    assert.equal(parsed.run.status, 'running');
  });
});

test('zz run start: --input k=v repeated pairs become run.inputs', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    out.length = 0;
    await run(['run', 'start', 'actions:flow', '--input', 'lead=acme', '--input', 'stage=new', '--json'], io);
    const { runId } = JSON.parse(out[0]);
    const note = readNote(home, 'runs', runId);
    assert.deepEqual(note.inputs, { lead: 'acme', stage: 'new' });
  });
});

test('zz run start: a bad addr or a missing workflow is a structured error, exit 1', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    out.length = 0;
    let code = await run(['run', 'start', 'not-an-addr'], io);
    assert.equal(code, 1);
    out.length = 0;
    code = await run(['run', 'start', 'actions:ghost', '--json'], io);
    assert.equal(code, 1);
    assert.match(JSON.parse(out[0]).error, /no note/);
  });
});

test('zz run advance: ticks one step; --json carries the tick result', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }, { id: 'b', run: 'true', 'depends-on': 'a' }] });
    out.length = 0;
    await run(['run', 'start', 'actions:flow', '--json'], io);
    const { runId } = JSON.parse(out[0]);

    out.length = 0;
    let code = await run(['run', 'advance', runId, '--json'], io);
    assert.equal(code, 0);
    let parsed = JSON.parse(out[0]);
    assert.equal(parsed.status, 'running');
    assert.equal(parsed.step, 'a');

    out.length = 0;
    code = await run(['run', 'advance', runId, '--json'], io);
    parsed = JSON.parse(out[0]);
    assert.equal(parsed.status, 'done');
    assert.equal(parsed.step, 'b');
  });
});

test('zz run advance --all: accepts BOTH `--all <id>` and `<id> --all` orderings (the naive flag-parser footgun)', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }, { id: 'b', run: 'true', 'depends-on': 'a' }] });

    out.length = 0;
    await run(['run', 'start', 'actions:flow', '--json'], io);
    const run1 = JSON.parse(out[0]).runId;
    out.length = 0;
    let code = await run(['run', 'advance', '--all', run1, '--json'], io); // --all BEFORE the id
    assert.equal(code, 0);
    assert.equal(JSON.parse(out[0]).status, 'done');

    out.length = 0;
    await run(['run', 'start', 'actions:flow', '--json'], io);
    const run2 = JSON.parse(out[0]).runId;
    out.length = 0;
    code = await run(['run', 'advance', run2, '--all', '--json'], io); // id BEFORE --all
    assert.equal(code, 0);
    assert.equal(JSON.parse(out[0]).status, 'done');
  });
});

test('zz run advance: a genuine failure exits 1 and surfaces the failed step', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'boom', run: 'false' }] });
    out.length = 0;
    await run(['run', 'start', 'actions:flow', '--json'], io);
    const { runId } = JSON.parse(out[0]);
    out.length = 0;
    const code = await run(['run', 'advance', runId, '--json'], io);
    assert.equal(code, 1);
    const parsed = JSON.parse(out[0]); // --json carries the RAW advanceRun() result verbatim
    assert.equal(parsed.status, 'failed');
    assert.equal(parsed.failedStep, 'boom');
  });
});

test('zz run advance: an unknown run id is a structured error, exit 1', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    out.length = 0;
    const code = await run(['run', 'advance', 'ghost-run', '--json'], io);
    assert.equal(code, 1);
    assert.match(JSON.parse(out[0]).error, /no run/);
  });
});

test('zz run signal / zz run complete: resolve a waiting run each their own way', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'w1', wait: { on: 'go' } }, { id: 'w2', wait: { on: 'go' }, 'depends-on': 'w1' }] });
    out.length = 0;
    await run(['run', 'start', 'actions:flow', '--json'], io);
    const { runId } = JSON.parse(out[0]);
    await run(['run', 'advance', runId], io); // → waiting on w1

    out.length = 0;
    let code = await run(['run', 'signal', runId, 'go', '--json'], io);
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out[0]), { ok: true, step: 'w1' });

    out.length = 0;
    await run(['run', 'advance', runId], io); // → waiting on w2

    out.length = 0;
    code = await run(['run', 'complete', runId, 'w2', '--json'], io);
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out[0]), { ok: true, step: 'w2' });
  });
});

test('zz run signal: an unknown signal on a waiting run is a structured error', async () => {
  await withRepo(async ({ cwd, home, io, out }) => {
    initHome(cwd);
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'w', wait: { on: 'go' } }] });
    out.length = 0;
    await run(['run', 'start', 'actions:flow', '--json'], io);
    const { runId } = JSON.parse(out[0]);
    await run(['run', 'advance', runId], io);
    out.length = 0;
    const code = await run(['run', 'signal', runId, 'nope', '--json'], io);
    assert.equal(code, 1);
    assert.match(JSON.parse(out[0]).error, /no waiting step matches/);
  });
});

test('the `run` namespace is discoverable in `zz help`', async () => {
  await withRepo(async ({ io, out }) => {
    out.length = 0;
    await run(['help'], io);
    const help = out.join('\n');
    for (const line of ['run start', 'run advance', 'run signal', 'run complete']) {
      assert.ok(help.includes(line), `help lists '${line}'`);
    }
  });
});

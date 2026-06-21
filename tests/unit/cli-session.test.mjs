// rung 8b — the v2 `session` verb wiring (router → sessions/ engine, now v2-native).
// Engine internals are covered by the 9 session-* suites; this proves the router
// dispatches and renders. Needs real git (session-git is git-backed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from '../../src/cli/index.mjs';
import { openSession, checkpoint } from '../../src/sessions/session-git.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

const sh = (cwd, ...a) => spawnSync(a[0], a.slice(1), { cwd, encoding: 'utf8' });

async function withGitRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-cs-'));
  sh(cwd, 'git', 'init', '-q', '-b', 'main');
  sh(cwd, 'git', 'config', 'user.email', 't@t.co');
  sh(cwd, 'git', 'config', 'user.name', 't');
  writeFileSync(join(cwd, 'a.txt'), 'hello');
  sh(cwd, 'git', 'add', '-A'); sh(cwd, 'git', 'commit', '-qm', 'init');
  resetCapabilities();
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, io, out, text: () => out.join('\n') }); }
  finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}

test('session status: reports the git-backed session state', async () => {
  await withGitRepo(async ({ io, text }) => {
    assert.equal(await run(['session', 'status'], io), 0);
    assert.match(text(), /session\[1\]\{enabled,main,branch,checkpoints,onBranch\}/);
    assert.match(text(), /true,main/);
  });
});

test('session: status shows the branch + checkpoint after the engine opens one', async () => {
  await withGitRepo(async ({ cwd, io, out }) => {
    openSession(cwd, 'demo-1');
    writeFileSync(join(cwd, 'b.txt'), 'work');
    checkpoint(cwd);
    out.length = 0;
    assert.equal(await run(['session', 'status'], io), 0);
    assert.match(out.join('\n'), /zz\/session-demo1/);
    assert.match(out.join('\n'), /,1,true/, 'one checkpoint, on the session branch');
  });
});

test('session merge: squashes the session branch to one commit', async () => {
  await withGitRepo(async ({ cwd, io, out }) => {
    openSession(cwd, 'demo-2');
    writeFileSync(join(cwd, 'c.txt'), 'work');
    checkpoint(cwd);
    out.length = 0;
    assert.equal(await run(['session', 'merge', '--title', 'demo work'], io), 0);
    assert.match(out.join('\n'), /squashed 1 checkpoint/);
    const log = sh(cwd, 'git', 'log', '--oneline').stdout;
    assert.match(log, /session: demo work/, 'one squashed session commit on main');
  });
});

test('session discard: refuses without --yes', async () => {
  await withGitRepo(async ({ io, out }) => {
    assert.equal(await run(['session', 'discard'], io), 1);
    assert.match(out.join('\n'), /refusing without --yes/);
  });
});

test('session worktree list: renders (empty by default)', async () => {
  await withGitRepo(async ({ io, out }) => {
    assert.equal(await run(['session', 'worktree', 'list'], io), 0);
    assert.match(out.join('\n'), /worktrees\[/);
  });
});

test('session: an unknown subcommand is a structured error', async () => {
  await withGitRepo(async ({ io, out }) => {
    assert.equal(await run(['session', 'frobnicate'], io), 1);
    assert.match(out.join('\n'), /unknown: zz session frobnicate/);
  });
});

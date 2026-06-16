// Wave B B2a: the `zuzuu session worktree <open|close|list|discard>` CLI seam
// the daemon shells out to (open → get path → spawn PTY there; close → merge).
// Thin print/dispatch over the (separately-tested) session-worktree.mjs module;
// here we characterize the dispatch, --json output, and exit codes. Hermetic tmp
// repos + a chdir (the command reads process.cwd()), restored in finally.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sessionWorktree } from '../../zuzuu/commands/session-worktree.mjs';

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function tmpRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-wtcmd-'));
  git(['init', '-q', '-b', 'main'], root);
  git(['config', 'user.email', 'test@zuzuu.dev'], root);
  git(['config', 'user.name', 'zuzuu test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'a.txt'), 'one\n');
  git(['add', '-A'], root);
  git(['commit', '-q', '-m', 'init'], root);
  const prev = process.cwd();
  process.chdir(root);
  try { return fn(root); } finally { process.chdir(prev); rmSync(root, { recursive: true, force: true }); }
}

/** Run the command, capturing console.log/error and intercepting process.exit. */
function run(args) {
  const out = [];
  const err = [];
  const origLog = console.log;
  const origErr = console.error;
  const origExit = process.exit;
  let exitCode = null;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => err.push(a.join(' '));
  process.exit = (c) => { exitCode = c ?? 0; throw new Error(`__exit_${exitCode}`); };
  try { sessionWorktree(args); } catch (e) { if (!String(e.message).startsWith('__exit_')) throw e; }
  finally { console.log = origLog; console.error = origErr; process.exit = origExit; }
  return { out: out.join('\n'), err: err.join('\n'), exitCode };
}

test('open --json returns ok + worktree path on its own branch', () => {
  tmpRepo(() => {
    const r = run({ _: ['open', 'abc12345'], json: true });
    assert.equal(r.exitCode, null, 'no exit on success');
    const d = JSON.parse(r.out);
    assert.equal(d.ok, true);
    assert.equal(d.branch, 'zz/session-abc12345');
    assert.match(d.worktree, /\.zuzuu\/\.worktrees\/abc12345$/);
  });
});

test('open without an id exits non-zero with usage', () => {
  tmpRepo(() => {
    const r = run({ _: ['open'] });
    assert.equal(r.exitCode, 1);
    assert.match(r.err, /usage/);
  });
});

test('list --json reports the open worktree, then none after close', () => {
  tmpRepo(() => {
    run({ _: ['open', 'list0001'], json: true });
    const before = JSON.parse(run({ _: ['list'], json: true }).out);
    assert.equal(before.length, 1);
    assert.equal(before[0].branch, 'zz/session-list0001');
    run({ _: ['close', 'list0001'], json: true });
    const after = JSON.parse(run({ _: ['list'], json: true }).out);
    assert.equal(after.length, 0);
  });
});

test('close --json round-trips a change to the base branch', () => {
  tmpRepo((root) => {
    const open = JSON.parse(run({ _: ['open', 'close001'], json: true }).out);
    writeFileSync(join(open.worktree, 'b.txt'), 'hi\n');
    const r = run({ _: ['close', 'close001'], title: 'add b', json: true });
    assert.equal(r.exitCode, null);
    const d = JSON.parse(r.out);
    assert.equal(d.ok, true);
    assert.equal(d.mergedTo, 'main');
  });
});

test('discard refuses without --yes, drops with it', () => {
  tmpRepo(() => {
    run({ _: ['open', 'disc0001'], json: true });
    const refused = run({ _: ['discard', 'disc0001'] });
    assert.equal(refused.exitCode, 1);
    assert.match(refused.err, /--yes/);
    const dropped = run({ _: ['discard', 'disc0001'], yes: true, json: true });
    assert.equal(JSON.parse(dropped.out).ok, true);
    assert.equal(JSON.parse(run({ _: ['list'], json: true }).out).length, 0);
  });
});

test('unknown subcommand exits non-zero', () => {
  tmpRepo(() => {
    const r = run({ _: ['bogus'] });
    assert.equal(r.exitCode, 1);
    assert.match(r.err, /unknown/);
  });
});

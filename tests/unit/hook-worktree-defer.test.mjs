// Wave B B2b: the host lifecycle hook must DEFER in-place session-git branch
// open/close when the agent runs inside a daemon-owned session worktree (the
// daemon owns that branch). It must STILL checkpoint on a turn (commits land on
// the worktree's own session branch). Hermetic git repos; no host data needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { handleHook } from '../../zuzuu/commands/hook.mjs';
import { openSessionWorktree } from '../../zuzuu/sessions/session-worktree.mjs';
import { currentBranch } from '../../zuzuu/sessions/git.mjs';

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}
function branchExists(ref, cwd) {
  return spawnSync('git', ['rev-parse', '-q', '--verify', `refs/heads/${ref}`], { cwd }).status === 0;
}
function tmpRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-hookwt-'));
  git(['init', '-q', '-b', 'main'], root);
  git(['config', 'user.email', 'test@zuzuu.dev'], root);
  git(['config', 'user.name', 'zuzuu test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'a.txt'), 'one\n');
  git(['add', '-A'], root);
  git(['commit', '-q', '-m', 'init'], root);
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('OPEN inside a session worktree defers — no second in-place branch is created', () => {
  tmpRepo((root) => {
    const { worktree } = openSessionWorktree(root, 'wtsess01'); // daemon owns zz/session-wtsess01
    handleHook({ event: 'session_start', payload: { session_id: 'hostxyz9' }, cwd: worktree, host: 'claude-code' });
    // the in-place open would have created zz/session-hostxyz — it must NOT
    assert.equal(branchExists('zz/session-hostxyz', root), false, 'no in-place branch from the hook');
    assert.equal(currentBranch(worktree), 'zz/session-wtsess01', 'worktree stays on its own branch');
  });
});

test('TURN inside a session worktree STILL checkpoints onto the worktree branch', () => {
  tmpRepo((root) => {
    const { worktree } = openSessionWorktree(root, 'wtsess02');
    writeFileSync(join(worktree, 'work.txt'), 'agent output\n');
    handleHook({ event: 'Stop', payload: { session_id: 'hostabc1' }, cwd: worktree, host: 'claude-code' });
    // a checkpoint commit landed on the worktree branch; main is untouched
    assert.equal(git(['rev-list', '--count', 'main..zz/session-wtsess02'], root), '1', 'one checkpoint on the branch');
    assert.equal(git(['rev-list', '--count', 'main..main'], root), '0', 'main untouched');
  });
});

test('END inside a session worktree defers the squash-merge to the daemon', () => {
  tmpRepo((root) => {
    const { worktree } = openSessionWorktree(root, 'wtsess03');
    writeFileSync(join(worktree, 'work.txt'), 'agent output\n');
    handleHook({ event: 'Stop', payload: { session_id: 'h' }, cwd: worktree, host: 'claude-code' }); // checkpoint
    const mainBefore = git(['rev-parse', 'main'], root);
    handleHook({ event: 'SessionEnd', payload: { session_id: 'h' }, cwd: worktree, host: 'claude-code' });
    assert.equal(git(['rev-parse', 'main'], root), mainBefore, 'main NOT advanced by the hook');
    assert.equal(branchExists('zz/session-wtsess03', root), true, 'worktree branch still present (daemon closes it)');
  });
});

test('control: OPEN in the MAIN tree (not a worktree) still opens in place', () => {
  tmpRepo((root) => {
    handleHook({ event: 'session_start', payload: { session_id: 'plainsesh' }, cwd: root, host: 'claude-code' });
    assert.equal(branchExists('zz/session-plainses', root), true, 'in-place branch created off main');
  });
});

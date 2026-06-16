// Wave B: per-session git WORKTREES — the concurrency primitive. Each session
// gets its own checked-out dir + branch (shared .git), so N agents run at once
// without fighting over one working tree. Additive to the in-place session-git
// model (which session-git.test.mjs characterizes); not yet wired to the daemon.
// Hermetic tmp repos only — never touches the zuzuu repo itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { currentBranch, git as gitPlumb } from '../../zuzuu/sessions/git.mjs';
import {
  openSessionWorktree,
  checkpointWorktree,
  closeSessionWorktree,
  listSessionWorktrees,
  worktreePath,
  inSessionWorktree,
} from '../../zuzuu/sessions/session-worktree.mjs';

function git(args, cwd, input) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', input });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

/** True if a local branch no longer exists (rev-parse exits non-zero → gone). */
function branchGone(ref, cwd) {
  return spawnSync('git', ['rev-parse', '-q', '--verify', `refs/heads/${ref}`], { cwd }).status !== 0;
}

function tmpRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-wt-'));
  git(['init', '-q', '-b', 'main'], root);
  git(['config', 'user.email', 'test@zuzuu.dev'], root);
  git(['config', 'user.name', 'zuzuu test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'a.txt'), 'one\n');
  git(['add', '-A'], root);
  git(['commit', '-q', '-m', 'init'], root);
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('openSessionWorktree creates a worktree on a new branch off base; main tree is NOT switched', () => {
  tmpRepo((root) => {
    const r = openSessionWorktree(root, 'abc12345-xyz');
    assert.equal(r.ok, true);
    assert.equal(r.branch, 'zz/session-abc12345');
    assert.equal(r.worktree, worktreePath(realpathSync(root), 'abc12345-xyz'));
    assert.ok(existsSync(r.worktree), 'worktree dir exists');
    assert.equal(currentBranch(root), 'main', 'main tree stays on main (vs in-place checkout)');
    assert.equal(currentBranch(r.worktree), 'zz/session-abc12345', 'worktree is on the session branch');
  });
});

test('concurrency: two different sessions open two worktrees (no single-branch block)', () => {
  tmpRepo((root) => {
    const a = openSessionWorktree(root, 'aaaa1111');
    const b = openSessionWorktree(root, 'bbbb2222');
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.notEqual(a.worktree, b.worktree);
    assert.equal(currentBranch(a.worktree), 'zz/session-aaaa1111');
    assert.equal(currentBranch(b.worktree), 'zz/session-bbbb2222');
    assert.equal(listSessionWorktrees(root).length, 2);
  });
});

test('resume: re-opening the same id returns the existing worktree (no error)', () => {
  tmpRepo((root) => {
    const a = openSessionWorktree(root, 'abc12345');
    const again = openSessionWorktree(root, 'abc12345');
    assert.equal(again.ok, true);
    assert.equal(again.resumed, true);
    assert.equal(again.worktree, a.worktree);
  });
});

test('checkpointWorktree commits work inside the worktree, leaving main untouched', () => {
  tmpRepo((root) => {
    const { worktree } = openSessionWorktree(root, 'feat0001');
    writeFileSync(join(worktree, 'b.txt'), 'new\n');
    const cp = checkpointWorktree(worktree);
    assert.equal(cp.ok, true);
    assert.equal(cp.committed, true);
    // main has no b.txt; the branch does
    assert.equal(existsSync(join(root, 'b.txt')), false);
    assert.equal(git(['rev-list', '--count', 'main..zz/session-feat0001'], root), '1');
  });
});

test('round-trip: open → checkpoint → close = ONE squash commit on base, worktree + branch gone', () => {
  tmpRepo((root) => {
    const { worktree } = openSessionWorktree(root, 'round001');
    writeFileSync(join(worktree, 'b.txt'), 'hello\n');
    checkpointWorktree(worktree);
    const r = closeSessionWorktree(root, 'round001', { title: 'add b' });
    assert.equal(r.ok, true);
    assert.equal(r.mergedTo, 'main');
    assert.ok(r.mergedAs, 'a squash commit landed');
    // b.txt now on main; worktree + branch removed
    assert.equal(readFileSync(join(root, 'b.txt'), 'utf8'), 'hello\n');
    assert.equal(existsSync(worktree), false);
    assert.equal(branchGone('zz/session-round001', root), true, 'session branch deleted');
    assert.equal(listSessionWorktrees(root).length, 0);
  });
});

test('close folds uncommitted worktree changes into the squash', () => {
  tmpRepo((root) => {
    const { worktree } = openSessionWorktree(root, 'fold0001');
    writeFileSync(join(worktree, 'c.txt'), 'uncommitted\n'); // never checkpointed
    const r = closeSessionWorktree(root, 'fold0001', { title: 'fold' });
    assert.equal(r.ok, true);
    assert.equal(readFileSync(join(root, 'c.txt'), 'utf8'), 'uncommitted\n');
  });
});

test('close with no changes cleans up the worktree + branch, no commit', () => {
  tmpRepo((root) => {
    openSessionWorktree(root, 'empty001');
    const r = closeSessionWorktree(root, 'empty001');
    assert.equal(r.ok, true);
    assert.equal(r.mergedAs, null);
    assert.equal(listSessionWorktrees(root).length, 0);
  });
});

test('conflict on close: abort cleanly — branch + worktree intact, base untouched', () => {
  tmpRepo((root) => {
    const { worktree } = openSessionWorktree(root, 'conf0001');
    writeFileSync(join(worktree, 'a.txt'), 'session change\n');
    checkpointWorktree(worktree);
    // main edits the SAME file → squash will conflict
    writeFileSync(join(root, 'a.txt'), 'main change\n');
    git(['commit', '-qam', 'main edit'], root);
    const mainHead = git(['rev-parse', 'HEAD'], root);

    const r = closeSessionWorktree(root, 'conf0001');
    assert.equal(r.ok, false);
    assert.equal(r.conflict, true);
    assert.equal(git(['rev-parse', 'HEAD'], root), mainHead, 'main HEAD unmoved');
    assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'main change\n', 'base file intact');
    assert.ok(existsSync(worktree), 'worktree kept for retry');
    assert.equal(git(['rev-parse', '-q', '--verify', 'refs/heads/zz/session-conf0001'], root).length > 0, true);
  });
});

test('inSessionWorktree: true inside a session worktree, false in the main tree', () => {
  tmpRepo((root) => {
    const { worktree } = openSessionWorktree(root, 'detect01');
    assert.equal(inSessionWorktree(worktree), true, 'cwd inside the worktree');
    assert.equal(inSessionWorktree(root), false, 'main tree is not a session worktree');
  });
});

test('inSessionWorktree: false for a non-git dir (fail-soft)', () => {
  const d = mkdtempSync(join(tmpdir(), 'zz-wt-nox-'));
  try { assert.equal(inSessionWorktree(d), false); } finally { rmSync(d, { recursive: true, force: true }); }
});

test('non-git dir: every op is a quiet {ok:false} no-op', () => {
  const d = mkdtempSync(join(tmpdir(), 'zz-wt-nogit-'));
  try {
    assert.equal(openSessionWorktree(d, 'x').ok, false);
    assert.equal(closeSessionWorktree(d, 'x').ok, false);
    assert.deepEqual(listSessionWorktrees(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

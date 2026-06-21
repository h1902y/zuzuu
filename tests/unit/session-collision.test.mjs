// Regression: the short-id collision the ce review found. Two distinct session
// ids that share the first 8 alphanumerics map to the same branch/worktree — the
// guard stamps the FULL id and refuses to resume a different session's branch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openSession, sessionBranchName } from '../../src/sessions/session-git.mjs';
import { openSessionWorktree } from '../../src/sessions/session-worktree.mjs';

const sh = (cwd, ...a) => spawnSync(a[0], a.slice(1), { cwd, encoding: 'utf8' });
function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-coll-'));
  sh(cwd, 'git', 'init', '-q', '-b', 'main'); sh(cwd, 'git', 'config', 'user.email', 't@t.co'); sh(cwd, 'git', 'config', 'user.name', 't');
  writeFileSync(join(cwd, 'a.txt'), 'x'); sh(cwd, 'git', 'add', '-A'); sh(cwd, 'git', 'commit', '-qm', 'init');
  try { return fn(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

// the two ids collide: both sanitize+truncate to 'abc12345'
const ID_A = 'abc12345-de67-aaaa';
const ID_B = 'abc1-2345-de67-bbbb';

test('collision: distinct ids share a branch name but the full id differs', () => {
  assert.equal(sessionBranchName(ID_A), sessionBranchName(ID_B), 'precondition: the short names collide');
});

test('openSession: a colliding second id is blocked, not silently resumed onto the first branch', () => {
  withRepo((cwd) => {
    const a = openSession(cwd, ID_A);
    assert.equal(a.ok, true);
    // we are now on session A's branch; opening B (same short id) must NOT resume A
    const b = openSession(cwd, ID_B);
    assert.equal(b.ok, false);
    assert.equal(b.collision, true);
    assert.equal(b.resumed ?? false, false, 'B did not silently resume A’s branch');
  });
});

test('openSessionWorktree: a colliding second id is blocked, not given the first’s worktree', () => {
  withRepo((cwd) => {
    const a = openSessionWorktree(cwd, ID_A);
    assert.equal(a.ok, true);
    const b = openSessionWorktree(cwd, ID_B);
    assert.equal(b.ok, false);
    assert.equal(b.collision, true);
  });
});

test('openSession: re-opening the SAME id resumes normally (no false collision)', () => {
  withRepo((cwd) => {
    assert.equal(openSession(cwd, ID_A).ok, true);
    const again = openSession(cwd, ID_A);
    assert.equal(again.ok, true);
    assert.equal(again.resumed, true);
  });
});

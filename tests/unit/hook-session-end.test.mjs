// tests/unit/hook-session-end.test.mjs
//
// CHARACTERIZATION + behavior for the END lifecycle beat (U3 of the session-merge-
// gate plan). BEFORE U3 the in-place hook END squash-MERGED the session branch to
// main (closeSession). AFTER U3 it FINALIZES (holds): it folds uncommitted work
// into a final checkpoint and renames the branch out of the active namespace, but
// it NEVER merges — main HEAD is left untouched. The squash-merge moves behind the
// explicit `zz session merge` gate.
//
// This test pins the NEW contract (it would have failed on the old merge code):
// END on a dirty in-place session → the branch is HELD, main HEAD unchanged.
//
// Hermetic: a tmp git repo + an isolated ZUZUU_HOME. The observe/digest side-effects
// of handleHook are best-effort (fully try-wrapped in the hook); we assert only the
// git state. Nothing here may ever touch the zuzuu repo itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { handleHook } from '../../src/hosts/hook.mjs';
import { openSession, listSessionBranches, listHeldBranches } from '../../src/sessions/session-git.mjs';

function git(args, cwd, input) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', input });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

/** A tmp git repo + an isolated ZUZUU_HOME so no hook side-effect leaks home-ward. */
function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-hook-end-'));
  const cfg = mkdtempSync(join(tmpdir(), 'zz-hook-end-cfg-'));
  const prev = process['env'].ZUZUU_HOME;
  process['env'].ZUZUU_HOME = cfg;
  git(['init', '-q', '-b', 'main'], root);
  git(['config', 'user.email', 'test@zuzuu.dev'], root);
  git(['config', 'user.name', 'zuzuu test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'a.txt'), 'one\n');
  git(['add', '-A'], root);
  git(['commit', '-q', '-m', 'init'], root);
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cfg, { recursive: true, force: true });
    if (prev === undefined) delete process['env'].ZUZUU_HOME; else process['env'].ZUZUU_HOME = prev;
  }
}

const logSubjects = (cwd, range) =>
  git(['log', '--format=%s', range], cwd).split('\n').filter(Boolean);

test('END FINALIZES (holds) the in-place session — branch held, main HEAD unchanged (never merges)', () => {
  withRepo((cwd) => {
    const a = openSession(cwd, 'aaaa-1111');
    assert.equal(a.ok, true);
    assert.equal(a.branch, 'zz/session-aaaa1111');
    const mainHead = git(['rev-parse', 'main'], cwd);

    // dirty, uncommitted work at END time
    writeFileSync(join(cwd, 'a.txt'), 'work at end\n');

    const r = handleHook({ event: 'SessionEnd', host: 'claude-code', cwd, payload: { session_id: 'aaaa-1111' } });
    assert.equal(r.event, 'SessionEnd');

    // main HEAD is UNCHANGED — END never auto-merges anymore.
    assert.equal(git(['rev-parse', 'main'], cwd), mainHead, 'main HEAD unchanged — END holds, never merges');
    assert.deepEqual(logSubjects(cwd, 'main'), ['init'], 'no session: squash commit landed on main');

    // the branch is HELD out of the active namespace (folded work on it).
    assert.deepEqual(listSessionBranches(cwd), [], 'no active session branch left');
    assert.deepEqual(listHeldBranches(cwd), ['zz/held-aaaa1111'], 'branch held, awaiting the merge gate');
    assert.deepEqual(
      logSubjects(cwd, 'main..zz/held-aaaa1111'),
      ['zz: checkpoint 1'],
      'the held branch carries the folded final checkpoint',
    );
  });
});

test('END in a daemon-owned worktree DEFERS (the daemon holds it) — main tree untouched', () => {
  withRepo((cwd) => {
    // Simulate the daemon worktree path: a session branch checked out in a linked
    // worktree under .zuzuu/worktrees/. The hook, running INSIDE that worktree,
    // must defer (inSessionWorktree) — it never finalizes there.
    git(['worktree', 'add', '-q', '-b', 'zz/session-wt000001', '.zuzuu/worktrees/wt000001', 'main'], cwd);
    const wt = join(cwd, '.zuzuu', 'worktrees', 'wt000001');
    assert.ok(existsSync(wt));

    const before = git(['rev-parse', '--abbrev-ref', 'HEAD'], wt);
    handleHook({ event: 'SessionEnd', host: 'claude-code', cwd: wt, payload: { session_id: 'wt000001' } });

    // the hook deferred — the worktree branch is NOT renamed/held by the in-place path.
    assert.equal(git(['rev-parse', '--abbrev-ref', 'HEAD'], wt), before, 'worktree still on its session branch (deferred)');
    assert.deepEqual(listHeldBranches(cwd), [], 'no in-place hold happened in a worktree');
  });
});

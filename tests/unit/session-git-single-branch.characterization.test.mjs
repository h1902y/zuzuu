// tests/unit/session-git-single-branch.characterization.test.mjs
//
// CHARACTERIZATION test (Wave-3 / W2c design unit). It does NOT drive new
// behavior — it PINS the CURRENT invariant so the Wave-3 redesign (per-session
// git worktrees, to support concurrent sessions) can be done with a safety net:
// any change to the single-working-branch rule will fail here LOUDLY and force a
// conscious decision.
//
// THE INVARIANT (today): one git working tree can hold at most ONE zz/session-*
// branch at a time. While one session branch exists, openSession() REFUSES a
// SECOND one — it returns { ok:false, blocked:true, existing:<the first branch> }
// and never creates a second branch. This is why true concurrent sessions need a
// structural change (worktrees), documented in
// docs/plans/2026-06-16-session-waves-2-3-remainder.md.
//
// Hermetic: mirrors the tmp-repo setup from tests/unit/session-git.test.mjs.
// Nothing here may ever touch the zuzuu repo itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openSession, listSessionBranches } from '../../src/sessions/session-git.mjs';

function git(args, cwd, input) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', input });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

/** Hermetic repo: main branch, local identity, one initial commit. */
function tmpRepo(fn, { branch = 'main' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'zz-sgit-char-'));
  git(['init', '-q', '-b', branch], root);
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
  }
}

const curBranch = (cwd) => git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);

// ── the pinned invariant ────────────────────────────────────────────────────

test('CHARACTERIZATION: a single working tree refuses a SECOND concurrent session branch', () => {
  tmpRepo((cwd) => {
    // First session opens cleanly and checks out its branch.
    const first = openSession(cwd, 'aaaa-1111-rest');
    assert.equal(first.ok, true);
    assert.equal(first.branch, 'zz/session-aaaa1111');
    assert.equal(curBranch(cwd), 'zz/session-aaaa1111');

    // A second, DIFFERENT session id is blocked — the invariant under test.
    const second = openSession(cwd, 'bbbb-2222-rest');
    assert.equal(second.ok, false, 'a second concurrent session is refused');
    assert.equal(second.blocked, true, 'refusal is signalled as blocked:true');
    assert.equal(second.existing, 'zz/session-aaaa1111', 'names the branch that holds the tree');

    // No second branch was ever created — still EXACTLY ONE zz/session-* branch,
    // and the working tree is still on the first session's branch.
    assert.deepEqual(
      listSessionBranches(cwd),
      ['zz/session-aaaa1111'],
      'exactly one session branch — concurrency needs per-session worktrees',
    );
    assert.equal(curBranch(cwd), 'zz/session-aaaa1111', 'tree unmoved by the blocked open');
  });
});

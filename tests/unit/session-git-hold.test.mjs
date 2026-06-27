// tests/unit/session-git-hold.test.mjs
//
// CHARACTERIZATION + behavior tests for the namespace-safe HOLD (U2 of the
// session-merge-gate plan). The in-place session model (session-git.mjs) keeps
// at most one `zz/session-*` branch and BLOCKS a second open while one exists.
// For the merge gate we must be able to END a session WITHOUT merging, yet
// without leaving a leftover that (a) blocks the next session's open, or
// (b) lets the next session's checkpoints land on the prior branch
// (cross-session contamination).
//
// finalizeSession() solves both: it folds uncommitted work into a final
// checkpoint, renames the branch OUT of the `zz/session-*` namespace into the
// held `zz/held-*` namespace (which openSession/listSessionBranches don't gate
// on), and checks out the base branch so the working tree no longer sits on a
// session branch.
//
// We FIRST pin today's broken in-place behavior (a leftover session branch
// blocks + contaminates the next session), then prove finalizeSession removes
// both the block and the contamination.
//
// Hermetic: mirrors the tmp-repo setup from the other session-git tests.
// Nothing here may ever touch the zuzuu repo itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  openSession,
  checkpoint,
  finalizeSession,
  listSessionBranches,
  listHeldBranches,
} from '../../src/sessions/session-git.mjs';

function git(args, cwd, input) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', input });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

/** Hermetic repo: main branch, local identity, one initial commit. */
function tmpRepo(fn, { branch = 'main' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'zz-sgit-hold-'));
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
const headSha = (cwd, ref = 'HEAD') => git(['rev-parse', ref], cwd);
const logSubjects = (cwd, range) =>
  git(['log', '--format=%s', range], cwd).split('\n').filter(Boolean);

// ── pin today's broken in-place behavior (the hazard finalize removes) ───────

test('CHARACTERIZATION: WITHOUT finalize, a leftover session branch BLOCKS the next open', () => {
  tmpRepo((cwd) => {
    const a = openSession(cwd, 'aaaa-1111');
    assert.equal(a.ok, true);
    assert.equal(a.branch, 'zz/session-aaaa1111');
    // session A ends, but nothing folds/renames the branch — it's a raw leftover.

    const b = openSession(cwd, 'bbbb-2222');
    assert.equal(b.ok, false, 'the leftover blocks the second open');
    assert.equal(b.blocked, true);
    assert.equal(b.existing, 'zz/session-aaaa1111');
  });
});

// ── finalizeSession: the held branch does not block the next open ────────────

test('finalizeSession holds the branch out of the active namespace; the next open is NOT blocked', () => {
  tmpRepo((cwd) => {
    const a = openSession(cwd, 'aaaa-1111');
    assert.equal(a.ok, true);
    // do real work in session A
    writeFileSync(join(cwd, 'a.txt'), 'changed by A\n');
    checkpoint(cwd);

    const fin = finalizeSession(cwd);
    assert.equal(fin.ok, true, 'finalize succeeds');
    assert.equal(fin.held, 'zz/held-aaaa1111', 'renamed into the held namespace');
    assert.equal(fin.base, 'main', 'base recorded');

    // the active namespace is now EMPTY; the held namespace holds the branch.
    assert.deepEqual(listSessionBranches(cwd), [], 'no active session branch left');
    assert.deepEqual(listHeldBranches(cwd), ['zz/held-aaaa1111'], 'held branch discoverable');

    // working tree is back on base — NOT on a session branch.
    assert.equal(curBranch(cwd), 'main', 'checked out base after finalize');

    // the next session opens cleanly — the held branch is non-blocking.
    const b = openSession(cwd, 'bbbb-2222');
    assert.equal(b.ok, true, 'second open is not blocked by the held branch');
    assert.equal(b.branch, 'zz/session-bbbb2222');
    assert.equal(b.blocked, undefined);
  });
});

// ── finalizeSession: no cross-session checkpoint contamination ───────────────

test("finalizeSession's base-checkout prevents B's checkpoints from landing on A's held branch", () => {
  tmpRepo((cwd) => {
    // Session A: one checkpoint, then finalize (held + base checked out).
    openSession(cwd, 'aaaa-1111');
    writeFileSync(join(cwd, 'a.txt'), 'A work\n');
    const cpA = checkpoint(cwd);
    assert.equal(cpA.committed, true);
    const heldTip = finalizeSession(cwd).held;
    const heldSha = headSha(cwd, heldTip);

    // Session B: a fresh branch off base, its own checkpoint.
    const b = openSession(cwd, 'bbbb-2222');
    assert.equal(b.branch, 'zz/session-bbbb2222');
    writeFileSync(join(cwd, 'b.txt'), 'B work\n');
    const cpB = checkpoint(cwd);
    assert.equal(cpB.committed, true);

    // B's checkpoint landed on B's OWN branch, not the held one.
    assert.equal(curBranch(cwd), 'zz/session-bbbb2222');
    assert.equal(headSha(cwd, heldTip), heldSha, "A's held branch tip is untouched by B");

    // B's branch has only B's checkpoint; A's held branch has only A's.
    const bSubjects = logSubjects(cwd, 'main..zz/session-bbbb2222');
    assert.deepEqual(bSubjects, ['zz: checkpoint 1'], 'B carries exactly one checkpoint');
    assert.ok(!git(['log', '--format=%H', 'main..zz/session-bbbb2222'], cwd).includes(heldSha),
      "B's history does not include A's checkpoint commit (no contamination)");
  });
});

// ── finalizeSession folds uncommitted work into a final checkpoint ───────────

test('finalizeSession folds uncommitted work into a final checkpoint on the held branch', () => {
  tmpRepo((cwd) => {
    openSession(cwd, 'cccc-3333');
    // dirty, uncommitted work at END time
    writeFileSync(join(cwd, 'a.txt'), 'uncommitted at end\n');

    const fin = finalizeSession(cwd);
    assert.equal(fin.ok, true);
    assert.equal(fin.checkpoints, 1, 'the uncommitted work folded into one checkpoint');

    // main HEAD is untouched (no merge happened); the held branch carries the work.
    const mainSubjects = logSubjects(cwd, 'main');
    assert.deepEqual(mainSubjects, ['init'], 'main HEAD unchanged — finalize never merges');
    assert.deepEqual(
      logSubjects(cwd, 'main..zz/held-cccc3333'),
      ['zz: checkpoint 1'],
      'the held branch carries the folded checkpoint',
    );
  });
});

// ── finalizeSession is a clean no-op when there is no session branch ─────────

test('finalizeSession returns no-session-branch when nothing is open', () => {
  tmpRepo((cwd) => {
    const fin = finalizeSession(cwd);
    assert.equal(fin.ok, false);
    assert.equal(fin.reason, 'no-session-branch');
  });
});

// ── finalizeSession respects unsafeReason preconditions (fail-soft) ──────────

test('finalizeSession is a fail-soft no-op outside a git repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-sgit-hold-norepo-'));
  try {
    const fin = finalizeSession(root);
    assert.equal(fin.ok, false);
    assert.equal(fin.reason, 'not-a-git-repo');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('finalizeSession fail-soft no-op with an operation in progress (preserves the held branch invariant)', () => {
  tmpRepo((cwd) => {
    openSession(cwd, 'dddd-4444');
    writeFileSync(join(cwd, 'a.txt'), 'work\n');
    checkpoint(cwd);
    // simulate a user merge/rebase in progress — hands off
    writeFileSync(join(git(['rev-parse', '--absolute-git-dir'], cwd), 'MERGE_HEAD'), headSha(cwd));

    const fin = finalizeSession(cwd);
    assert.equal(fin.ok, false);
    assert.equal(fin.reason, 'operation-in-progress');
    // the active session branch is left intact (not renamed mid-operation)
    assert.deepEqual(listSessionBranches(cwd), ['zz/session-dddd4444']);
    assert.deepEqual(listHeldBranches(cwd), []);
  });
});

// ── listHeldBranches enumerates only the held namespace ──────────────────────

test('listSessionBranches and listHeldBranches keep their namespaces separate', () => {
  tmpRepo((cwd) => {
    assert.deepEqual(listHeldBranches(cwd), []);
    openSession(cwd, 'aaaa-1111');
    writeFileSync(join(cwd, 'a.txt'), 'A\n');
    checkpoint(cwd);
    finalizeSession(cwd);
    openSession(cwd, 'bbbb-2222');

    // one active, one held — neither list bleeds into the other.
    assert.deepEqual(listSessionBranches(cwd), ['zz/session-bbbb2222']);
    assert.deepEqual(listHeldBranches(cwd), ['zz/held-aaaa1111']);
  });
});

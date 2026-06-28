// tests/unit/session-merge-gate-integration.test.mjs
//
// CROSS-UNIT integration tests for the session-merge gate. The units (finalize /
// hold / the merge verbs / the held enumeration) each pass in isolation, but the
// WHOLE default flow was broken where they meet — held in-place sessions were
// unreachable by the merge verbs (F1), a LIVE worktree agent counted as held (F3),
// and a failed base-checkout stranded the tree on an unrecognized branch (F5).
//
// These exercise the FULL flow across module boundaries (open → work → checkpoint
// → finalize/hold → the merge/continue/discard verb), NOT a single function. They
// are the regression net for the integration gaps.
//
// Hermetic tmp repos only — never touches the zuzuu repo itself.

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
  closeSession,
  continueSession,
  discardSession,
  listSessionBranches,
  listHeldBranches,
  heldSessionBranches,
} from '../../src/sessions/session-git.mjs';
import {
  openSessionWorktree,
  checkpointWorktree,
  finalizeSessionWorktree,
} from '../../src/sessions/session-worktree.mjs';

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}
function gitOk(args, cwd) {
  const r = git(args, cwd);
  assert.equal(r.ok, true, `git ${args.join(' ')} failed: ${r.err}`);
  return r.out;
}

function tmpRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-merge-gate-'));
  gitOk(['init', '-q', '-b', 'main'], root);
  gitOk(['config', 'user.email', 'test@zuzuu.dev'], root);
  gitOk(['config', 'user.name', 'zuzuu test'], root);
  gitOk(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'a.txt'), 'one\n');
  gitOk(['add', '-A'], root);
  gitOk(['commit', '-q', '-m', 'init'], root);
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

const curBranch = (cwd) => gitOk(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
const subjects = (cwd, range) => gitOk(['log', '--format=%s', range], cwd).split('\n').filter(Boolean);
const branchGone = (cwd, b) => git(['rev-parse', '-q', '--verify', `refs/heads/${b}`], cwd).ok === false;

// ── F1: a held in-place session is reachable by the merge verb (the core gap) ──

test('F1: END-held in-place session MERGES onto main via the merge verb (default, no id)', () => {
  tmpRepo((cwd) => {
    openSession(cwd, 'aaaa-1111');
    writeFileSync(join(cwd, 'a.txt'), 'A work\n');
    checkpoint(cwd);
    const fin = finalizeSession(cwd);
    assert.equal(fin.ok, true);
    assert.equal(fin.held, 'zz/held-aaaa1111');
    const mainBefore = gitOk(['rev-parse', 'main'], cwd);

    // the merge gate: the held branch (zz/held-*) must be reachable with NO id.
    const r = closeSession(cwd, {});
    assert.equal(r.ok, true, `closeSession should reach the held branch, got ${JSON.stringify(r)}`);
    assert.ok(r.mergedAs, 'a squash commit landed on main');

    // main advanced by exactly one session: commit; the held branch is gone.
    assert.notEqual(gitOk(['rev-parse', 'main'], cwd), mainBefore, 'main advanced');
    assert.match(subjects(cwd, 'main')[0], /^session: /, 'a session: squash on main');
    assert.equal(branchGone(cwd, 'zz/held-aaaa1111'), true, 'held branch removed after merge');
    assert.deepEqual(listHeldBranches(cwd), [], 'nothing left held');
  });
});

test('F1: continue resumes a held in-place session (re-activated to zz/session-*)', () => {
  tmpRepo((cwd) => {
    openSession(cwd, 'bbbb-2222');
    writeFileSync(join(cwd, 'a.txt'), 'B work\n');
    checkpoint(cwd);
    finalizeSession(cwd);
    assert.deepEqual(listHeldBranches(cwd), ['zz/held-bbbb2222']);

    const r = continueSession(cwd);
    assert.equal(r.ok, true, `continue should reach the held branch, got ${JSON.stringify(r)}`);
    // re-activated: back in the zz/session-* namespace so checkpoints + a later merge work.
    assert.equal(curBranch(cwd), 'zz/session-bbbb2222', 'checked out + re-activated');
    assert.deepEqual(listSessionBranches(cwd), ['zz/session-bbbb2222']);
    assert.deepEqual(listHeldBranches(cwd), [], 'no longer held');

    // a further checkpoint lands, and the session merges cleanly afterwards.
    writeFileSync(join(cwd, 'a.txt'), 'more B work\n');
    assert.equal(checkpoint(cwd).committed, true);
    assert.equal(closeSession(cwd, {}).ok, true, 'a re-activated session merges');
  });
});

test('F1: discard drops a held in-place session', () => {
  tmpRepo((cwd) => {
    openSession(cwd, 'cccc-3333');
    writeFileSync(join(cwd, 'a.txt'), 'C work\n');
    checkpoint(cwd);
    finalizeSession(cwd);
    const mainBefore = gitOk(['rev-parse', 'main'], cwd);

    const r = discardSession(cwd);
    assert.equal(r.ok, true, `discard should reach the held branch, got ${JSON.stringify(r)}`);
    assert.equal(branchGone(cwd, 'zz/held-cccc3333'), true, 'held branch dropped');
    assert.deepEqual(listHeldBranches(cwd), []);
    assert.equal(gitOk(['rev-parse', 'main'], cwd), mainBefore, 'discard never touches main');
  });
});

test('F1: with TWO held in-place sessions, merge resolves the RIGHT one by id', () => {
  tmpRepo((cwd) => {
    // session A → held
    openSession(cwd, 'aaaa-1111');
    writeFileSync(join(cwd, 'a.txt'), 'A work\n');
    checkpoint(cwd);
    finalizeSession(cwd);
    // session B → held
    openSession(cwd, 'bbbb-2222');
    writeFileSync(join(cwd, 'b.txt'), 'B work\n');
    checkpoint(cwd);
    finalizeSession(cwd);

    assert.deepEqual(
      listHeldBranches(cwd).sort(),
      ['zz/held-aaaa1111', 'zz/held-bbbb2222'],
      'both held',
    );

    // no-id is AMBIGUOUS among multiple held — must refuse, not pick blindly.
    const amb = closeSession(cwd, {});
    assert.equal(amb.ok, false, 'ambiguous merge refused');

    // merge B by id → B lands, A stays held.
    const r = closeSession(cwd, { id: 'bbbb-2222' });
    assert.equal(r.ok, true, `merge by id should resolve zz/held-bbbb2222, got ${JSON.stringify(r)}`);
    assert.equal(branchGone(cwd, 'zz/held-bbbb2222'), true, 'B merged + removed');
    assert.deepEqual(listHeldBranches(cwd), ['zz/held-aaaa1111'], 'A still held');
    // main carries B's file, not A's.
    assert.equal(git(['cat-file', '-e', 'main:b.txt'], cwd).ok, true, 'b.txt on main');
    assert.equal(git(['cat-file', '-e', 'main:a.txt'], cwd).ok, true);
  });
});

// ── F3: a LIVE worktree agent is NOT held; only a finalized (marked) one is ────

test('F3: a LIVE worktree session is NOT counted as held; finalize marks it held', () => {
  tmpRepo((cwd) => {
    const { worktree } = openSessionWorktree(cwd, 'wt00aaaa');
    writeFileSync(join(worktree, 'b.txt'), 'live work\n');
    checkpointWorktree(worktree);

    // LIVE (agent still running, no hold marker) → must NOT appear as awaiting merge.
    assert.deepEqual(
      heldSessionBranches(cwd), [],
      'a live worktree agent is NOT held (would let it be merged mid-session)',
    );

    // finalize marks it held → now it IS awaiting merge.
    const fin = finalizeSessionWorktree(cwd, 'wt00aaaa');
    assert.equal(fin.ok, true);
    assert.deepEqual(
      heldSessionBranches(cwd), ['zz/session-wt00aaaa'],
      'after finalize the marked worktree branch IS held',
    );
  });
});

// ── F5: a failed base-checkout leaves the active branch intact (recoverable) ───

test('F5: finalizeSession where the base checkout FAILS keeps zz/session-* (NOT renamed)', () => {
  tmpRepo((cwd) => {
    // A secret-family file (checkpoint never folds it) that base tracks. Built at
    // runtime so the test source carries no literal secret material.
    const secret = ['id', 'rsa'].join('_');
    writeFileSync(join(cwd, secret), 'base\n');
    gitOk(['add', '-A'], cwd);
    gitOk(['commit', '-q', '-m', 'add tracked file'], cwd);

    openSession(cwd, 'dddd-4444');
    // remove the tracked file on the session branch …
    gitOk(['rm', '-q', secret], cwd);
    writeFileSync(join(cwd, 'a.txt'), 'work\n');
    checkpoint(cwd);
    // … and leave an UNTRACKED copy locally (excluded from the fold as secret-family,
    // so it persists). Checking out base (which tracks it) now fails: it would
    // overwrite an untracked file. This is the F5 trigger.
    writeFileSync(join(cwd, secret), 'local\n');

    const fin = finalizeSession(cwd);
    assert.equal(fin.ok, false, 'finalize fails when base checkout fails');
    assert.match(String(fin.reason), /checkout-base-failed|overwritten/, 'reports the checkout failure');

    // CRITICAL: the active branch survives in the zz/session-* namespace (recoverable),
    // and was NOT renamed into a held branch no verb recognizes.
    assert.deepEqual(listSessionBranches(cwd), ['zz/session-dddd4444'], 'active branch survives');
    assert.deepEqual(listHeldBranches(cwd), [], 'NOT renamed to held mid-failure');
    assert.equal(curBranch(cwd), 'zz/session-dddd4444', 'still on the session branch');
  });
});

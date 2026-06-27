// tests/unit/session-review.test.mjs
//
// sessionReview (U4 of the session-merge-gate plan) — the PURE READ that informs
// the merge decision: diff summary + checkpoint count + squash title +
// mergeability vs current `main`. It must NEVER mutate the repo.
//
// THE critical test (characterization, non-negotiable): the mergeability probe
// uses `git merge-tree --write-tree` — a real merge that writes only loose
// objects. We pin that the working tree AND the index are byte-identical before
// and after sessionReview, in BOTH the clean ('ready') AND conflicting
// ('conflict') cases — the crash-window hazard that rules out a `merge --squash`
// probe. We also pin: 'ready' when main is unchanged, 'conflict' when main
// advanced with a conflicting hunk, correct files/±lines/checkpoints, the squash
// title, and fail-soft on a missing branch / no-commits.
//
// Hermetic: tmp repos only. Nothing here may ever touch the zuzuu repo itself.

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
  sessionReview,
  defaultTitle,
} from '../../src/sessions/session-git.mjs';

function git(args, cwd, input) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', input });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

/** Hermetic repo: main branch, local identity, an 8-line tracked file. */
function tmpRepo(fn, { branch = 'main' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'zz-sreview-'));
  git(['init', '-q', '-b', branch], root);
  git(['config', 'user.email', 'test@zuzuu.dev'], root);
  git(['config', 'user.name', 'zuzuu test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'f.txt'), 'a\nb\nc\nd\ne\nf\ng\nh\n');
  git(['add', '-A'], root);
  git(['commit', '-q', '-m', 'init'], root);
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A full, comparable snapshot of the repo's mutable state: HEAD, the working
 *  tree (porcelain, untracked included) and the index (every stage entry). If
 *  the probe mutated anything, one of these strings changes. */
function repoState(cwd) {
  return {
    head: git(['rev-parse', 'HEAD'], cwd),
    status: git(['status', '--porcelain', '-uall'], cwd),
    index: git(['ls-files', '--stage'], cwd),
  };
}

/** Make a held (`zz/held-*`) session branch with two checkpoints; leaves the
 *  working tree on `main` (base). Returns the held branch name. */
function makeHeldBranch(cwd) {
  openSession(cwd, 'aaaa-1111');
  writeFileSync(join(cwd, 'f.txt'), 'a\nb\nC-EDIT\nd\ne\nf\ng\nh\n'); // change line c
  const cp1 = checkpoint(cwd);
  assert.equal(cp1.committed, true);
  writeFileSync(join(cwd, 'new.txt'), 'x\ny\nz\n'); // a new 3-line file
  const cp2 = checkpoint(cwd);
  assert.equal(cp2.committed, true);
  const fin = finalizeSession(cwd);
  assert.equal(fin.ok, true);
  assert.equal(fin.held, 'zz/held-aaaa1111');
  return fin.held;
}

// ── diff summary + checkpoints + title (golden, from a real git run) ─────────

test('sessionReview reports the diff summary, checkpoint count, base, and squash title', () => {
  tmpRepo((cwd) => {
    const held = makeHeldBranch(cwd);
    const r = sessionReview(cwd, held);
    assert.equal(r.ok, true);
    assert.equal(r.branch, held);
    assert.equal(r.base, 'main');
    assert.equal(r.files, 2, '2 changed files');
    assert.equal(r.added, 4, '1 (line edit) + 3 (new file)');
    assert.equal(r.removed, 1, '1 (line edit)');
    assert.equal(r.checkpoints, 2);
    assert.equal(r.title, defaultTitle(held), 'reuses the same squash title closeSession uses');
  });
});

// ── mergeability: ready when main is unchanged since base ────────────────────

test("mergeability is 'ready' when main has not advanced since the branch's base", () => {
  tmpRepo((cwd) => {
    const held = makeHeldBranch(cwd);
    const r = sessionReview(cwd, held);
    assert.equal(r.ok, true);
    assert.equal(r.mergeability, 'ready');
  });
});

// ── mergeability: conflict when main advanced with a conflicting hunk ─────────

test("mergeability is 'conflict' when main advanced with a conflicting change", () => {
  tmpRepo((cwd) => {
    const held = makeHeldBranch(cwd); // edits line c; tree is back on main
    // main advances, editing the SAME line c differently → a real merge conflict.
    writeFileSync(join(cwd, 'f.txt'), 'a\nb\nMAIN-EDIT\nd\ne\nf\ng\nh\n');
    git(['commit', '-q', '-am', 'main advances on line c'], cwd);

    const r = sessionReview(cwd, held);
    assert.equal(r.ok, true);
    assert.equal(r.mergeability, 'conflict');
  });
});

// ── mergeability: a non-conflicting advance on a far-apart line stays ready ───

test("mergeability stays 'ready' when main advances on a non-conflicting, far-apart line", () => {
  tmpRepo((cwd) => {
    const held = makeHeldBranch(cwd); // edits line c
    writeFileSync(join(cwd, 'f.txt'), 'a\nb\nc\nd\ne\nf\ng\nH-EDIT\n'); // line h — far from c
    git(['commit', '-q', '-am', 'main advances on line h'], cwd);

    const r = sessionReview(cwd, held);
    assert.equal(r.ok, true);
    assert.equal(r.mergeability, 'ready');
  });
});

// ── THE characterization: the probe never mutates — CLEAN case ───────────────

test('CHARACTERIZATION: sessionReview leaves the working tree + index byte-identical (ready case)', () => {
  tmpRepo((cwd) => {
    const held = makeHeldBranch(cwd);
    // dirty the tree a little so the snapshot is non-trivial (untracked + modified)
    writeFileSync(join(cwd, 'f.txt'), 'a\nb\nc\nd\ne\nf\ng\nDIRTY\n');
    writeFileSync(join(cwd, 'untracked.txt'), 'loose\n');
    git(['add', 'f.txt'], cwd); // a staged change in the index, too

    const before = repoState(cwd);
    const r = sessionReview(cwd, held);
    assert.equal(r.ok, true);
    assert.equal(r.mergeability, 'ready');
    const after = repoState(cwd);

    assert.equal(after.head, before.head, 'HEAD unchanged');
    assert.equal(after.status, before.status, 'working tree (porcelain) byte-identical');
    assert.equal(after.index, before.index, 'index (ls-files --stage) byte-identical');
  });
});

// ── THE characterization: the probe never mutates — CONFLICT case ────────────
// This is the highest-risk path: a mutating probe that detects a conflict could
// strand MERGE_HEAD / a half-staged index in the user's repo. merge-tree must not.

test('CHARACTERIZATION: sessionReview leaves the working tree + index byte-identical (conflict case)', () => {
  tmpRepo((cwd) => {
    const held = makeHeldBranch(cwd);
    writeFileSync(join(cwd, 'f.txt'), 'a\nb\nMAIN-EDIT\nd\ne\nf\ng\nh\n');
    git(['commit', '-q', '-am', 'main conflicts on line c'], cwd);
    // dirty the tree after the conflicting commit
    writeFileSync(join(cwd, 'untracked2.txt'), 'loose\n');

    const before = repoState(cwd);
    const r = sessionReview(cwd, held);
    assert.equal(r.ok, true);
    assert.equal(r.mergeability, 'conflict');
    const after = repoState(cwd);

    assert.equal(after.head, before.head, 'HEAD unchanged on conflict');
    assert.equal(after.status, before.status, 'working tree byte-identical on conflict');
    assert.equal(after.index, before.index, 'index byte-identical on conflict');

    // no merge-state leaked into the repo
    const gitDir = git(['rev-parse', '--absolute-git-dir'], cwd);
    for (const f of ['MERGE_HEAD', 'MERGE_MSG', 'AUTO_MERGE']) {
      const r2 = spawnSync('test', ['-e', join(gitDir, f)]);
      assert.notEqual(r2.status, 0, `${f} must not exist after the probe`);
    }
  });
});

// ── works on a worktree-held (zz/session-*) branch too ───────────────────────

test('sessionReview works on an active zz/session-* branch (worktree-held shape)', () => {
  tmpRepo((cwd) => {
    const open = openSession(cwd, 'bbbb-2222');
    assert.equal(open.ok, true);
    assert.equal(open.branch, 'zz/session-bbbb2222');
    writeFileSync(join(cwd, 'f.txt'), 'a\nb\nC-EDIT\nd\ne\nf\ng\nh\n');
    checkpoint(cwd);

    const before = repoState(cwd);
    const r = sessionReview(cwd, 'zz/session-bbbb2222');
    assert.equal(r.ok, true);
    assert.equal(r.base, 'main', 'resolves the recorded zz-base');
    assert.equal(r.checkpoints, 1);
    assert.equal(r.files, 1);
    assert.equal(r.mergeability, 'ready');
    const after = repoState(cwd);
    assert.equal(after.status, before.status, 'no mutation while on the session branch');
    assert.equal(after.index, before.index, 'index untouched');
  });
});

// ── fail-soft ────────────────────────────────────────────────────────────────

test('sessionReview fail-soft: a branch that does not exist → no-such-branch', () => {
  tmpRepo((cwd) => {
    const r = sessionReview(cwd, 'zz/held-doesnotexist');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no-such-branch');
  });
});

test('sessionReview fail-soft: not a git repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-sreview-norepo-'));
  try {
    const r = sessionReview(root, 'zz/held-x');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'not-a-git-repo');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sessionReview fail-soft: an unborn repo (no commits) → no-commits', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-sreview-unborn-'));
  try {
    git(['init', '-q', '-b', 'main'], root);
    const r = sessionReview(root, 'zz/held-x');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no-commits');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

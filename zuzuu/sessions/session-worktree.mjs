// zuzuu/sessions/session-worktree.mjs — per-session git WORKTREES (Wave B).
//
// The in-place model (session-git.mjs) checks a `zz/session-*` branch out in the
// ONE working tree, so only one session can run at a time (the single-working-
// branch invariant). For CONCURRENCY, each session instead gets its OWN worktree
// (a separate checked-out dir on its own branch, sharing the repo's .git) under
// `.zuzuu/.worktrees/<short-id>/` (git-ignored). N agents then run at once
// without fighting over the working tree; the user's main tree never switches.
//
// Same safety posture as session-git.mjs: every op is try-wrapped and returns
// { ok:false, reason } — NEVER throws; all git goes through the argv plumbing;
// conflicts on close abort and leave the repo as it was. Checkpoint + the
// merge/secret/dirty logic are REUSED from session-git.mjs so the two models
// can't drift.

import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { git, branchExists, currentBranch, cleanupSquashState } from './git.mjs';
import {
  sessionGitEnabled,
  sessionBranchName,
  mainBranch,
  checkpoint,
  countCheckpoints,
  userDirty,
  defaultTitle,
} from './session-git.mjs';

/** The worktree dir name for a session — the same sanitized short id the branch
 *  uses (sessionBranchName = `zz/session-<short>`), so dir ↔ branch line up. */
function shortId(sessionId) {
  return String(sessionId ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'unknown';
}

/** Absolute path of a session's worktree dir under the repo's `.zuzuu/.worktrees/`. */
export function worktreePath(root, sessionId) {
  return join(root, '.zuzuu', '.worktrees', shortId(sessionId));
}

const repoRootOf = (cwd) => git(['rev-parse', '--show-toplevel'], cwd).out || null;

/** All registered worktrees as { path, branch } (parsed from porcelain). */
function allWorktrees(root) {
  const out = git(['worktree', 'list', '--porcelain'], root).out;
  if (!out) return [];
  const list = [];
  let cur = {};
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) cur = { path: line.slice('worktree '.length) };
    else if (line.startsWith('branch ')) cur.branch = line.slice('branch '.length).replace('refs/heads/', '');
    else if (line === '') { if (cur.path) list.push(cur); cur = {}; }
  }
  if (cur.path) list.push(cur);
  return list;
}

/** Session worktrees only (branch under zz/session-*), as { path, branch }. */
export function listSessionWorktrees(cwd) {
  try {
    const root = repoRootOf(cwd);
    if (!root) return [];
    return allWorktrees(root).filter((w) => (w.branch ?? '').startsWith('zz/session-'));
  } catch {
    return [];
  }
}

/**
 * OPEN: create (or resume) this session's worktree on its branch off the base.
 * Unlike the in-place openSession, this does NOT block on other session
 * branches — that's the whole point (concurrency). The main tree is untouched.
 */
export function openSessionWorktree(cwd, sessionId) {
  try {
    if (!sessionGitEnabled(cwd)) return { ok: false, reason: 'disabled' };
    const root = repoRootOf(cwd);
    if (!root) return { ok: false, reason: 'not-a-git-repo' };
    const branch = sessionBranchName(sessionId);
    const wt = worktreePath(root, sessionId);
    const base = mainBranch(cwd) || currentBranch(cwd);
    if (!base) return { ok: false, reason: 'no-base' };

    if (allWorktrees(root).some((w) => w.path === wt)) {
      return { ok: true, resumed: true, branch, worktree: wt, base };
    }
    mkdirSync(dirname(wt), { recursive: true });
    const add = branchExists(cwd, branch)
      ? git(['worktree', 'add', wt, branch], root) // resume an existing branch in a worktree
      : git(['worktree', 'add', '-b', branch, wt, base], root);
    if (!add.ok) return { ok: false, reason: add.err || 'worktree-add-failed' };
    git(['config', `branch.${branch}.zz-base`, base], root); // remember where to merge back
    return { ok: true, branch, worktree: wt, base };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** TURN: checkpoint commit INSIDE the worktree. The reused checkpoint() already
 *  guards "must be on a session branch" (the worktree is, by construction) and
 *  excludes the secret family. */
export function checkpointWorktree(worktreeDir) {
  return checkpoint(worktreeDir);
}

/**
 * END: fold any uncommitted worktree work, squash-merge the session branch into
 * its base (from the MAIN tree), then remove the worktree + branch.
 *   conflict → abort the squash, KEEP the branch + worktree for retry, base untouched
 *   empty squash WITH checkpoints → keep the branch (history never destroyed)
 */
export function closeSessionWorktree(cwd, sessionId, { title } = {}) {
  try {
    const root = repoRootOf(cwd);
    if (!root) return { ok: false, reason: 'not-a-git-repo' };
    const branch = sessionBranchName(sessionId);
    if (!branchExists(cwd, branch)) return { ok: false, reason: 'no-session-branch' };
    const wt = worktreePath(root, sessionId);
    const base = git(['config', `branch.${branch}.zz-base`], root).out || mainBranch(cwd);
    if (!base || base === branch) return { ok: false, reason: 'no-base' };

    // fold any uncommitted work in the worktree into the branch first
    let excludedSecrets = 0;
    if (existsSync(wt)) {
      const cp = checkpoint(wt);
      if (cp.ok) excludedSecrets = cp.excludedSecrets ?? 0;
    }
    const commits = countCheckpoints(cwd, branch);

    // the MAIN tree must be on base to squash-merge into it; never clobber the
    // user's loose changes there.
    const cur = currentBranch(root);
    if (cur !== base) {
      if (userDirty(root)) return { ok: false, reason: 'dirty-worktree' };
      if (!git(['checkout', '-q', base], root).ok) return { ok: false, reason: 'checkout-base-failed' };
    }

    const merge = git(['merge', '--squash', branch], root);
    if (!merge.ok) {
      git(['reset', '--merge'], root);
      cleanupSquashState(root);
      return { ok: false, conflict: true, branch, worktree: wt };
    }

    let mergedAs = null;
    const nothingStaged = git(['diff', '--cached', '--quiet'], root).ok; // exit 0 = nothing staged
    if (nothingStaged) {
      cleanupSquashState(root);
      if (commits > 0) {
        // exploration-only: real checkpoints but no net change — keep the branch
        return { ok: false, reason: 'empty-squash-with-checkpoints', commits, branch };
      }
    } else {
      const c = git(['commit', '-q', '-m', `session: ${title || defaultTitle(branch)}`], root);
      if (!c.ok) return { ok: false, reason: c.err || 'commit-failed' };
      mergedAs = git(['rev-parse', 'HEAD'], root).out || null;
    }

    // remove the worktree FIRST (frees the branch), then delete the branch
    git(['worktree', 'remove', '--force', wt], root);
    git(['config', '--unset', `branch.${branch}.zz-base`], root);
    git(['branch', '-D', branch], root);
    return { ok: true, mergedAs, mergedTo: base, commits, ...(excludedSecrets ? { excludedSecrets } : {}) };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** Recovery: drop a session's worktree + branch WITHOUT merging (the caller gates). */
export function discardSessionWorktree(cwd, sessionId) {
  try {
    const root = repoRootOf(cwd);
    if (!root) return { ok: false, reason: 'not-a-git-repo' };
    const branch = sessionBranchName(sessionId);
    const wt = worktreePath(root, sessionId);
    if (existsSync(wt)) git(['worktree', 'remove', '--force', wt], root);
    git(['config', '--unset', `branch.${branch}.zz-base`], root);
    if (branchExists(cwd, branch)) git(['branch', '-D', branch], root);
    return { ok: true, branch };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

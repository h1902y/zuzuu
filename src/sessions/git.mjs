// src/sessions/git.mjs — session-specific git helpers.
//
// what: thin, safe-by-construction git helpers (currentBranch, branchExists,
//       isDirty, …) over the one git primitive — argv arrays only (no shell
//       strings), never throw, return plain data.
// why:  isolate raw git from policy. Session POLICY (open/checkpoint/close/status
//       + the safety gates) lives in session-git.mjs; this file is just the wire.
//       The `git()` primitive itself now lives in `metal/git.mjs` (the one git
//       wrapper) and is RE-EXPORTED here byte-for-byte — this file historically owned
//       the richest wrapper, so promoting it unchanged keeps the safety-critical
//       session contract (and its characterization) identical.
// how:  the session helpers spawn through metal/git's `git()`; each returns plain
//       data. Zero-dep.

import { rmSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';

// THE one git primitive lives in metal/git — re-exported so every `./git.mjs`
// importer (session-git, session-worktree) keeps the exact same `git()`.
export { git } from '../metal/git.mjs';
import { git } from '../metal/git.mjs';

export function gitDir(cwd) {
  const r = git(['rev-parse', '--git-dir'], cwd);
  if (!r.ok || !r.out) return null;
  return isAbsolute(r.out) ? r.out : resolve(cwd, r.out);
}

/** Current branch name, or null when detached / not a repo. */
export function currentBranch(cwd) {
  const r = git(['symbolic-ref', '--short', '-q', 'HEAD'], cwd);
  return r.ok && r.out ? r.out : null;
}

export const branchExists = (cwd, name) => git(['rev-parse', '-q', '--verify', `refs/heads/${name}`], cwd).ok;
export const isDirty = (cwd) => !!git(['status', '--porcelain'], cwd).out;

/** Best-effort: drop squash leftovers so they can't leak into the user's next commit. */
export function cleanupSquashState(cwd) {
  const gd = gitDir(cwd);
  if (!gd) return;
  for (const f of ['SQUASH_MSG', 'MERGE_MSG']) {
    try {
      rmSync(join(gd, f), { force: true });
    } catch {
      /* best-effort */
    }
  }
}

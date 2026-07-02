// src/use/run-lock.mjs — the per-note run lock (safety floor, §I rung 3).
//
// what: refuse a SECOND concurrent run of the SAME note (`module:id`) rather than
//       letting two invocations' spawned children interleave. Lives in the XDG
//       cache dir (notes/store.mjs's cacheDir) — never the tracked `.zuzuu/` tree,
//       like the commit lock (grow/commit.mjs) it sits beside.
// why:  act()/runWorkflow() spawn real child processes with real side effects; a
//       double-click, a retried CI step, or two agent sessions racing the same
//       action all used to run concurrently with nothing noticing.
// how:  DELIBERATELY NOT metal/fs.mjs's `withLock` — that primitive BLOCKS (retries
//       up to ~5s) and STEALS on a short (15s) staleness window, built for a brief
//       critical section (one commit) where waiting a beat is fine. A run can take
//       up to MAX_TIMEOUT_S (10 minutes); blocking a second invocation for even a
//       few seconds behind a run in progress would be worse than just refusing —
//       and stealing after only 15s would kill a live, legitimate long run. So this
//       is REFUSE-FAST: `mkdirSync` (atomic, no `recursive`) is the lock itself; an
//       existing lock younger than its staleness window refuses immediately, one
//       older is presumed to be a crashed holder past its own timeout and is stolen.
//       Zero-dep, advisory (like every other lock in this codebase).

import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cacheDir } from '../notes/store.mjs';

/** Grace window added on top of a run's own timeout before its lock is considered
 *  stale — a run that finishes right at its timeout still needs a moment to log +
 *  release; without this margin a legitimate run could get its own lock stolen out
 *  from under it in a slow-CI/high-load moment. */
export const LOCK_GRACE_MS = 30_000;

const lockPath = (home, module, id) => join(cacheDir(home), 'run-locks', `${module}__${id}.lock`);

/**
 * Try to acquire the run lock for one note. Refuse-fast, never blocks.
 * @param {string} home
 * @param {string} module
 * @param {string} id
 * @param {number} staleAfterMs  a held lock older than this is presumed abandoned
 *   (the previous holder crashed past its own timeout) and is stolen rather than
 *   respected — callers pass the run's own resolved timeout + LOCK_GRACE_MS.
 * @returns {{ ok: true, release: () => void } | { ok: false, error: string, running: true }}
 */
export function acquireRunLock(home, module, id, staleAfterMs) {
  const lock = lockPath(home, module, id);
  mkdirSync(join(cacheDir(home), 'run-locks'), { recursive: true });
  const release = () => { try { rmSync(lock, { recursive: true, force: true }); } catch { /* already gone */ } };
  try {
    mkdirSync(lock); // atomic: first process to create this dir wins
    return { ok: true, release };
  } catch {
    // contended — fresh (someone else is genuinely running it) or stale (a crashed
    // holder)? A lock that vanishes between the failed mkdir and this stat (the
    // holder just finished) reads as "gone" — fall through and try to steal it,
    // which either succeeds (the common case) or loses a genuine race, in which
    // case we refuse below rather than spin.
    let age = Infinity;
    try { age = Date.now() - statSync(lock).mtimeMs; } catch { /* raced away */ }
    if (age > staleAfterMs) {
      release();
      try {
        mkdirSync(lock);
        return { ok: true, release };
      } catch { /* someone else stole it first — refuse below */ }
    }
    return { ok: false, error: `already running: '${module}:${id}'`, running: true };
  }
}

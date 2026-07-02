// src/metal/fs.mjs — the byte-I/O owner.
//
// what: the thin set of filesystem primitives the note layer reads and writes
//       bytes through — `readText`/`writeText`/`remove`/`list`/`mkdirp`.
// why:  before this, note bytes were read and written with `node:fs` calls sprinkled
//       across the writers (evolve, refactor, plan) and readers (check, index, gate).
//       This is the ONE place note bytes cross the filesystem boundary, so the next
//       rungs (a transaction ring, content trust) have a single seam to wrap.
// how:  direct, un-clever wrappers over `node:fs` — the only importer of node:fs for
//       note bytes. Metadata-only probes (existsSync, statSync, dirent listing) stay
//       with their callers; this file is about BYTES. Zero-dep.

import { readFileSync, writeFileSync, rmSync, readdirSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Read a file as UTF-8 text. Throws if the file is missing (callers guard or catch). */
export const readText = (path) => readFileSync(path, 'utf8');

/** Write text to a file, overwriting — ATOMICALLY (temp + rename in the same dir,
 *  so a crash mid-write can never leave a truncated source-of-truth note; readers
 *  see the old bytes or the new bytes, nothing between). Parent dir must exist. */
export const writeText = (path, text) => {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
};

/** Remove a single file. Throws if it is missing (callers guard). */
export const remove = (path) => rmSync(path);

/** List a directory's entry names (no dirent flags — plain names). */
export const list = (dir) => readdirSync(dir);

/** Create a directory and any missing parents (idempotent). */
export const mkdirp = (dir) => mkdirSync(dir, { recursive: true });

// synchronous sleep (the lock loop runs in sync write paths — no event loop to yield to)
const sleepSync = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* best effort */ } };

/**
 * Advisory cross-process lock around a critical section. `mkdirSync` without
 * `recursive` is atomic — first process in wins; others wait up to ~5s, stealing
 * a stale lock (holder crashed >15s ago). ADVISORY: on timeout we proceed anyway
 * rather than deadlock — three processes (CLI, daemon, bridge) share one vault
 * and the lock turns interleaved commits/rebuilds from likely into rare.
 */
export function withLock(dir, fn) {
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, '.zz-lock');
  const t0 = Date.now();
  for (;;) {
    try { mkdirSync(lock); break; } catch {
      try { if (Date.now() - statSync(lock).mtimeMs > 15000) { rmSync(lock, { recursive: true, force: true }); continue; } } catch { /* raced away */ }
      if (Date.now() - t0 > 5000) break; // advisory: never deadlock
      sleepSync(50);
    }
  }
  try { return fn(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

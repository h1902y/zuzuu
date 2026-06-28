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

import { readFileSync, writeFileSync, rmSync, readdirSync, mkdirSync } from 'node:fs';

/** Read a file as UTF-8 text. Throws if the file is missing (callers guard or catch). */
export const readText = (path) => readFileSync(path, 'utf8');

/** Write text to a file, overwriting. Parent dir must exist (use `mkdirp` first). */
export const writeText = (path, text) => writeFileSync(path, text);

/** Remove a single file. Throws if it is missing (callers guard). */
export const remove = (path) => rmSync(path);

/** List a directory's entry names (no dirent flags — plain names). */
export const list = (dir) => readdirSync(dir);

/** Create a directory and any missing parents (idempotent). */
export const mkdirp = (dir) => mkdirSync(dir, { recursive: true });

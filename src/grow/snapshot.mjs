// src/grow/snapshot.mjs — content-addressed per-module generations.
//
// what: pin a module's current notes as an immutable generation, and roll back by
//       restoring it.
// why:  rollback is a pointer-flip + content restore — never a `git revert`.
//       Immutable history; growth is adding objects and moving pointers, never
//       mutating in place.
// how:  a content store of SHA256-named blobs (deduped across modules and
//       generations) + per-module generation chains (integer counter = the
//       identity). Zero-dep (node:crypto + node:fs).

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { itemsDir, generationsDir } from '../notes/store.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const storeDir = (home) => join(generationsDir(home), '.store');
const genDir = (home, module) => join(generationsDir(home), module);

const blobPath = (home, hash) => join(storeDir(home), hash.slice(0, 2), hash.slice(2));

/** Put bytes into the content store; returns their hash (dedup is free). */
function put(home, buf) {
  const hash = sha(buf);
  const path = blobPath(home, hash);
  if (!existsSync(path)) { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, buf); }
  return hash;
}
const getBlob = (home, hash) => readFileSync(blobPath(home, hash));

/** The active generation pointer (a single small file — no JSON parse). */
function readActive(dir) {
  const a = join(dir, 'active');
  return existsSync(a) ? Number(readFileSync(a, 'utf8').trim()) : null;
}

/** The next generation number — from the filenames alone, no JSON parse. */
function nextN(dir) {
  if (!existsSync(dir)) return 1;
  const ns = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).map((f) => parseInt(f, 10));
  return (ns.length ? Math.max(...ns) : 0) + 1;
}

/** The module's generation entries (sorted by n), and the active pointer. */
export function generations(home, module) {
  const dir = genDir(home, module);
  if (!existsSync(dir)) return { generations: [], active: null };
  const gens = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))).sort((a, b) => a.n - b.n);
  return { generations: gens, active: readActive(dir) };
}

/**
 * Mint a generation: snapshot every note file in the module into the content
 * store and record {id → hash}. Advances the active pointer. Returns the entry.
 */
export function mint(home, module, { mintedFrom = [] } = {}) {
  const dir = genDir(home, module);
  mkdirSync(dir, { recursive: true });
  const items = {};
  const idir = itemsDir(home, module);
  if (existsSync(idir)) {
    for (const f of readdirSync(idir)) {
      if (!f.endsWith('.md')) continue;
      items[f.slice(0, -3)] = put(home, readFileSync(join(idir, f)));
    }
  }
  // next number + parent pointer WITHOUT parsing every prior generation's JSON
  const n = nextN(dir);
  const active = readActive(dir);
  const root = sha(Object.entries(items).sort().map(([k, v]) => `${k}:${v}`).join('\n'));
  const entry = { n, mintedAt: new Date().toISOString(), parent: active, root, mintedFrom, items };
  writeFileSync(join(dir, `${n}.json`), JSON.stringify(entry, null, 2) + '\n');
  writeFileSync(join(dir, 'active'), String(n));
  return entry;
}

/** Roll a module back to generation n: restore each note's bytes, flip active. */
export function rollback(home, module, n) {
  const { generations: gens } = generations(home, module);
  const entry = gens.find((g) => g.n === n);
  if (!entry) return { ok: false, error: `no generation ${n} for ${module}` };
  const idir = itemsDir(home, module);
  mkdirSync(idir, { recursive: true });
  // The pinned set is authoritative: PRUNE any note not in the generation before
  // restoring. Without this, a note created AFTER the generation survives a
  // rollback meant to undo it — the on-disk zuzuu would diverge from the active
  // generation (and a later mint would silently re-introduce the "deleted" note).
  const pinned = new Set(Object.keys(entry.items));
  let pruned = 0;
  for (const f of readdirSync(idir)) {
    if (f.endsWith('.md') && !pinned.has(f.slice(0, -3))) { rmSync(join(idir, f)); pruned++; }
  }
  let restored = 0;
  for (const [id, hash] of Object.entries(entry.items)) {
    writeFileSync(join(idir, `${id}.md`), getBlob(home, hash));
    restored++;
  }
  writeFileSync(join(genDir(home, module), 'active'), String(n));
  return { ok: true, module, n, restored, pruned };
}

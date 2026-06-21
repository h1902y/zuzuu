// zuzuu/kernel/snapshot.mjs — content-addressed snapshots (generations + checkpoints).
//
// what: pin a module's current zus as an immutable generation, and roll back by
//       restoring it. Compose all modules' actives into a whole-brain checkpoint.
// why:  one mechanism, two scopes (a module / the whole project). Rollback is a
//       pointer-flip + content restore — never a `git revert`. Immutable history;
//       growth is adding objects and moving pointers, never mutating in place.
// how:  a content store of SHA256-named blobs (deduped across modules and
//       generations) + per-module generation chains (integer counter = the
//       identity) + a whole-home checkpoint = a Merkle of (module, active-hash).
//       Zero-dep (node:crypto + node:fs).

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { paths, itemsDir } from './store.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const storeDir = (home) => join(paths_(home).generations, '.store');
const genDir = (home, module) => join(paths_(home).generations, module);
const paths_ = (home) => ({ generations: join(home, '.generations') });

const blobPath = (home, hash) => join(storeDir(home), hash.slice(0, 2), hash.slice(2));

/** Put bytes into the content store; returns their hash (dedup is free). */
function put(home, buf) {
  const hash = sha(buf);
  const path = blobPath(home, hash);
  if (!existsSync(path)) { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, buf); }
  return hash;
}
const getBlob = (home, hash) => readFileSync(blobPath(home, hash));

/** The module's generation entries (sorted by n), and the active pointer. */
export function generations(home, module) {
  const dir = genDir(home, module);
  if (!existsSync(dir)) return { generations: [], active: null };
  const gens = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))).sort((a, b) => a.n - b.n);
  let active = null;
  const a = join(dir, 'active');
  if (existsSync(a)) active = Number(readFileSync(a, 'utf8').trim());
  return { generations: gens, active };
}

/**
 * Mint a generation: snapshot every zu file in the module into the content
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
  const { generations: gens, active } = generations(home, module);
  const n = (gens.length ? Math.max(...gens.map((g) => g.n)) : 0) + 1;
  const root = sha(Object.entries(items).sort().map(([k, v]) => `${k}:${v}`).join('\n'));
  const entry = { n, mintedAt: null, parent: active, root, mintedFrom, items };
  writeFileSync(join(dir, `${n}.json`), JSON.stringify(entry, null, 2) + '\n');
  writeFileSync(join(dir, 'active'), String(n));
  return entry;
}

/** Roll a module back to generation n: restore each item's bytes, flip active. */
export function rollback(home, module, n) {
  const { generations: gens } = generations(home, module);
  const entry = gens.find((g) => g.n === n);
  if (!entry) return { ok: false, error: `no generation ${n} for ${module}` };
  const idir = itemsDir(home, module);
  mkdirSync(idir, { recursive: true });
  // restore: write every item from the snapshot (removes nothing not in the gen
  // beyond overwriting — full restore of the pinned set)
  let restored = 0;
  for (const [id, hash] of Object.entries(entry.items)) {
    writeFileSync(join(idir, `${id}.md`), getBlob(home, hash));
    restored++;
  }
  writeFileSync(join(genDir(home, module), 'active'), String(n));
  return { ok: true, module, n, restored };
}

// ── whole-brain checkpoints ─────────────────────────────────────────────────

const cpDir = (home) => join(paths_(home).generations, '.checkpoints');

/** Compose every module's active generation into one whole-brain pin. */
export function mintCheckpoint(home, modules, { label = null } = {}) {
  mkdirSync(cpDir(home), { recursive: true });
  const pins = {};
  for (const module of modules) {
    const { active } = generations(home, module);
    if (active != null) pins[module] = active;
  }
  const root = sha(Object.entries(pins).sort().map(([m, n]) => `${m}:${n}`).join('\n'));
  const id = root.slice(0, 12);
  writeFileSync(join(cpDir(home), `${id}.json`), JSON.stringify({ id, label, pins, root }, null, 2) + '\n');
  return { id, label, pins };
}

/** Roll the whole brain back to a checkpoint — every pinned module flips. */
export function rollbackCheckpoint(home, id) {
  const file = join(cpDir(home), `${id}.json`);
  if (!existsSync(file)) return { ok: false, error: `no checkpoint ${id}` };
  const cp = JSON.parse(readFileSync(file, 'utf8'));
  const restored = {};
  for (const [module, n] of Object.entries(cp.pins)) restored[module] = rollback(home, module, n);
  return { ok: true, id, restored };
}

export function listCheckpoints(home) {
  const dir = cpDir(home);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

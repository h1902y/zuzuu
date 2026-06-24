// src/notes/generation.mjs — git-native per-module generations (Data layer).
//
// what: the GENERATION entity — pin a module's notes as an immutable generation
//       (`mint`), read the lineage (`generations`), and roll one back (`rollback`).
//       A generation IS a git commit: minting writes the note + a path-scoped commit
//       of the module's durable state, so git's own objects hold every past version.
// why:  the `.zuzuu/` lives inside a git repo, so re-implementing a content store
//       (the old `.generations/.store/` blobs) duplicated git's object DB. Now the
//       module's history IS its git history; rollback = `git restore`, not a custom
//       pointer-flip. The Project stays 100% git-tracked, no parallel store.
// how:  a tiny per-module ledger `<module>/generations.json` records the lineage
//       ({n, mintedAt, mintedFrom}); each mint commits `.zuzuu/<module>` with a
//       `zz-gen: <module>/<n>` trailer, so n→commit is resolvable from git log.
//       Fail-soft: outside a git repo / on git error the ledger still advances
//       (the files are the source of truth) — rollback just needs a real repo.

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { itemsDir } from './store.mjs';
import { parse } from './note.mjs';

const git = (root, args) => {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};
const rootOf = (home) => dirname(home);                       // home = <root>/.zuzuu
const ledgerPath = (home, module) => join(home, module, 'generations.json');

const readLedger = (home, module) => {
  try { return JSON.parse(readFileSync(ledgerPath(home, module), 'utf8')); } catch { return []; }
};
function writeLedger(home, module, entries) {
  const p = ledgerPath(home, module);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(entries, null, 2) + '\n');
}

/** The module's generation lineage (ledger entries) + the active (latest) n. */
export function generations(home, module) {
  const gens = readLedger(home, module);
  return { generations: gens, active: gens.length ? gens[gens.length - 1].n : null };
}

/**
 * Commit the module's durable state as generation `n`. Scoped to `.zuzuu/<module>`
 * so the user's other (code) changes are never swept in. The `zz-gen:` trailer makes
 * the commit findable as generation n. Fail-soft: returns false on any git trouble.
 */
function commitGeneration(root, module, n, label) {
  const pathspec = `.zuzuu/${module}`;
  if (!existsSync(join(root, pathspec))) return false;
  git(root, ['add', '-A', '--', pathspec]);                   // stage adds/mods/dels, scoped
  const subject = `zz: ${label ?? `evolve ${module}`} (gen ${n})`;
  return git(root, ['commit', '-m', subject, '-m', `zz-gen: ${module}/${n}`, '--', pathspec]) != null;
}

/** All generation commits for the module, oldest→newest — position i = generation i+1. */
function genCommits(root, module) {
  const out = git(root, ['log', '--reverse', '--format=%H', '--grep', `zz-gen: ${module}/`, '--', `.zuzuu/${module}`]);
  return out ? out.split('\n').filter(Boolean) : [];
}
const commitForN = (root, module, n) => genCommits(root, module)[n - 1] ?? null;

/** The git commit SHA backing a module's generation `n` (or null). For diff/as-of. */
export function generationCommit(home, module, n) {
  return commitForN(rootOf(home), module, n);
}

/**
 * Time-travel: the module's notes as they were at generation `n` (read from that
 * generation's commit — never touches the working tree). @returns {{ok, notes?, error?}}
 */
export function notesAsOf(home, module, n) {
  const root = rootOf(home);
  const commit = commitForN(root, module, n);
  if (!commit) return { ok: false, error: `no generation ${n} for ${module}` };
  const tree = git(root, ['ls-tree', '-r', '--name-only', commit, `.zuzuu/${module}/items/`]) ?? '';
  const notes = tree.split('\n').filter((f) => f.endsWith('.md')).map((f) => {
    const id = f.split('/').pop().slice(0, -3);
    const { note } = parse(git(root, ['show', `${commit}:${f}`]) ?? '', { id });
    return { addr: `${module}:${id}`, type: note?.type ?? '', title: note?.title ?? '', status: note?.status ?? '' };
  });
  return { ok: true, module, generation: n, commit: commit.slice(0, 8), notes };
}

/**
 * Diff two of a module's generations: which notes were added/modified/deleted
 * between them (read-only — git holds the bytes). @returns {{ok, changes?, error?}}
 */
export function diffGenerations(home, module, from, to, { full = false } = {}) {
  const root = rootOf(home);
  const ca = commitForN(root, module, from);
  const cb = commitForN(root, module, to);
  if (!ca || !cb) return { ok: false, error: `no commit for ${module} generation ${!ca ? from : to}` };
  const path = `.zuzuu/${module}/items/`;
  const out = git(root, ['diff', '--name-status', ca, cb, '--', path]) ?? '';
  const changes = out.split('\n').filter(Boolean).map((line) => {
    const [st, file] = line.split('\t');
    return { status: st[0], id: (file || '').split('/').pop().replace(/\.md$/, '') };
  });
  const result = { ok: true, module, from, to, changes };
  if (full) result.patch = git(root, ['diff', ca, cb, '--', path]) ?? '';
  return result;
}

/**
 * Mint a generation: append the ledger entry and commit the module's state. The
 * commit is the generation (git holds the bytes). Returns the ledger entry.
 */
export function mint(home, module, { mintedFrom = [], label = null } = {}) {
  const gens = readLedger(home, module);
  const n = (gens.length ? gens[gens.length - 1].n : 0) + 1;
  const entry = { n, mintedAt: new Date().toISOString(), mintedFrom };
  writeLedger(home, module, [...gens, entry]);
  commitGeneration(rootOf(home), module, n, label);           // fail-soft: ledger stands regardless
  return entry;
}

/**
 * Roll a module back to generation n: restore its items from that generation's
 * commit, prune any note added since, and record the restore as a NEW generation
 * (forward motion — immutable history, never a `git revert`). Needs a real repo.
 */
export function rollback(home, module, n) {
  const gens = readLedger(home, module);
  if (!gens.find((g) => g.n === n)) return { ok: false, error: `no generation ${n} for ${module}` };
  const root = rootOf(home);
  const commit = commitForN(root, module, n);
  if (!commit) return { ok: false, error: `no commit for ${module} generation ${n} (needs a git repo)` };

  const idir = itemsDir(home, module);
  const onDisk = () => (existsSync(idir) ? readdirSync(idir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)) : []);
  const before = onDisk();
  // restore the items tree from gen n's commit (git restore also removes files
  // absent in that tree, so it prunes for us; the manual sweep is belt-and-suspenders)
  git(root, ['restore', '--source', commit, '--', `.zuzuu/${module}/items`]);
  const tree = git(root, ['ls-tree', '-r', '--name-only', commit, `.zuzuu/${module}/items/`]) || '';
  const pinned = new Set(tree.split('\n').filter((p) => p.endsWith('.md')).map((p) => p.split('/').pop().slice(0, -3)));
  if (existsSync(idir)) for (const f of readdirSync(idir)) {
    if (f.endsWith('.md') && !pinned.has(f.slice(0, -3))) rmSync(join(idir, f));
  }
  const pruned = before.filter((id) => !pinned.has(id)).length;
  // commit the restored state as the next generation (its content == gen n)
  const entry = mint(home, module, { mintedFrom: [`rollback:${n}`], label: `rollback ${module} to gen ${n}` });
  return { ok: true, module, n, newGeneration: entry.n, restored: pinned.size, pruned };
}

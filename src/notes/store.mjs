// src/notes/store.mjs — where things live on disk, and how to address them.
//
// what: resolve the project home (`.zuzuu/`) and the path of any note by its
//       `module:id` address. The single chokepoint for the project's filesystem.
// why:  store is the one place that knows the layout; everything else
//       asks store for a path. One place to know the layout.
// how:  the home is the host repo's git-root + `.zuzuu/` — zuzuu is a git-citizen,
//       so `git rev-parse --show-toplevel` IS the walk-up (resolves from any
//       subdir); falls back to cwd outside a git repo. Zero-dep (node:* only).
//       (Path resolution harvested from core/store.mjs.)

import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const git = (args, cwd) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** The host repo root via git, falling back to cwd outside a repo. */
export function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

/** The project home: the hidden `.zuzuu/` at the repo root. */
export function homeDir(root = repoRoot()) {
  return join(root, '.zuzuu');
}

/** The ephemeral per-session state dir (git-ignored). */
export const liveDir = (home) => join(home, '.live');

/** Current commit + branch, or nulls outside a git repo. */
export function gitInfo(cwd = process.cwd()) {
  return { commit: git(['rev-parse', 'HEAD'], cwd), branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) };
}

/** Canonical paths under the home. */
export function paths(cwd = process.cwd()) {
  const root = repoRoot(cwd);
  const home = homeDir(root);
  return {
    root,
    home,
    index: join(home, 'sessions.json'),
    live: liveDir(home),
    generations: join(home, '.generations'),
  };
}

// ── addressing ──────────────────────────────────────────────────────────────

/** Split a `module:id` address into `{ module, id }`. A bare `id` (no colon)
 *  yields `{ module: null, id }` — module supplied by context. */
export function parseAddress(addr) {
  const s = String(addr);
  const i = s.indexOf(':');
  return i === -1 ? { module: null, id: s } : { module: s.slice(0, i), id: s.slice(i + 1) };
}

// A module or note id is a single filename segment — never a path. Anything with
// a separator, `..`, or a non-slug char is rejected, so a crafted id/target (e.g.
// a proposal's `target: '../../guardrails/items/no-rm-rf'`) can't escape the
// module's items dir and overwrite — or neuter — another module's notes.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
export const isSafeSegment = (s) => typeof s === 'string' && s !== '.' && s !== '..' && !s.includes('..') && SAFE_SEGMENT.test(s);
const seg = (s, kind) => { if (!isSafeSegment(s)) throw new Error(`unsafe ${kind}: ${JSON.stringify(s)}`); return s; };

/** The directory a module's notes live in: `<home>/<module>/items/`. */
export function itemsDir(home, module) {
  return join(home, seg(module, 'module'), 'items');
}

/** The file path of a note by `module` + `id`: `<home>/<module>/items/<id>.md`. */
export function itemPath(home, module, id) {
  return join(itemsDir(home, module), `${seg(id, 'id')}.md`);
}

/** A module's manifest path: `<home>/<module>/module.md`. */
export function manifestPath(home, module) {
  return join(home, seg(module, 'module'), 'module.md');
}

/** Resolve a full `module:id` (or `{module}` + bare id) to a file path. */
export function resolve(home, addr, contextModule = null) {
  const { module, id } = parseAddress(addr);
  const m = module ?? contextModule;
  if (!m) throw new Error(`address '${addr}' needs a module (no context)`);
  return itemPath(home, m, id);
}

/** id = the filename stem of a note path. */
export const idFromPath = (p) => basename(String(p), '.md');

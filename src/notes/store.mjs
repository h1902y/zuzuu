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

import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// ── JSON files (the one convention) ───────────────────────────────────────────
// Every dir read/wrote JSON by hand with a slightly different fallback; these are
// the single definition. read returns `fallback` on missing/corrupt; write is
// pretty + trailing-newline (the convention the whole tree had copied) + mkdir -p.

/** Read + parse a JSON file; `fallback` (default null) on missing/unreadable/corrupt. */
export function readJson(path, fallback = null) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

/** Write `obj` as pretty JSON + trailing newline, creating parent dirs. */
export function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}

const git = (args, cwd) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

// The repo root never changes within a process, but git is a process spawn (~10ms)
// and `repoRoot` is called several times per command — memoize by cwd.
const rootCache = new Map();

/** The host repo root via git, falling back to cwd outside a repo. */
export function repoRoot(cwd = process.cwd()) {
  let root = rootCache.get(cwd);
  if (root === undefined) { root = git(['rev-parse', '--show-toplevel'], cwd) || cwd; rootCache.set(cwd, root); }
  return root;
}

/** The project home: the hidden `.zuzuu/` at the repo root. */
export function homeDir(root = repoRoot()) {
  return join(root, '.zuzuu');
}

// ── out-of-repo, machine-local dirs (XDG) ─────────────────────────────────────
// Rebuildable cache + transient run-state do NOT belong in the tracked tree (even
// gitignored). They live in OS dirs keyed to THIS project by a hash of its home
// path, so `.zuzuu/` stays 100% durable — a true git citizen, like `.git`.
const repoHash = (home) => createHash('sha256').update(home).digest('hex').slice(0, 16);
const xdg = (envVar, ...rel) => process.env[envVar] || join(homedir(), ...rel);

/** The project's rebuildable cache dir (XDG cache) — the sqlite index lives here. */
export const cacheDir = (home) => join(xdg('XDG_CACHE_HOME', '.cache'), 'zuzuu', repoHash(home));

/** The project's transient run-state dir (XDG state) — session digest + the gate log. */
export const stateDir = (home) => join(xdg('XDG_STATE_HOME', '.local', 'state'), 'zuzuu', repoHash(home));

/** Current commit + branch, or nulls outside a git repo. */
export function gitInfo(cwd = process.cwd()) {
  return { commit: git(['rev-parse', 'HEAD'], cwd), branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) };
}

/** The per-module generations store: `<home>/.generations/` (the layout chokepoint
 *  for snapshots — notes/generation.mjs builds its store under here). */
export const generationsDir = (home) => join(home, '.generations');

// ── addressing ──────────────────────────────────────────────────────────────

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

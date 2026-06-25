// src/notes/registry.mjs — the registry substrate (a `role: registry` .zuzuu repo).
//
// what: read/write the project-ref index + the shared-module library a registry
//       repo holds. The registry is a binding MANIFEST + a library of publishable
//       modules — NEVER an aggregation of subscriber notes, and it has no
//       loop/generations/gate over its OWN content (the no-master-Project rule).
//       Symmetric with notes/project.mjs + notes/module.mjs readers.
// why:  a durable, portable, git-native index of a user's projects + a personal
//       module library they subscribe from — the OSS pull-first registry.
// how:  project-refs are plain `type: project-ref` notes under `<home>/refs/`;
//       the library is ordinary modules (dirs with module.md). Parse with
//       notes/note; fail-soft, zero-dep (node:* only).

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { parse, serialize, idFromPath, slugify } from './note.mjs';
import { listModules } from './module.mjs';
import { homeDir } from './store.mjs';

const refsDir = (home) => join(home, 'refs');
const refPath = (home, handle) => join(refsDir(home), `${handle}.md`);

/**
 * Normalize a git remote for dedupe: collapse scheme + userinfo differences,
 * a trailing `.git`, and a trailing slash, lowercased. So `git@github.com:me/x.git`
 * and `https://github.com/me/x` both reduce to `github.com/me/x`. Falsy → ''.
 */
export function normalizeRemote(url) {
  if (!url) return '';
  let s = String(url).trim();
  const scp = /^[^@/]+@([^:]+):(.+)$/.exec(s); // scp-like: host:path → host/path
  if (scp) s = `${scp[1]}/${scp[2]}`;
  else s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^[^@/]+@/, ''); // drop scheme + userinfo
  s = s.replace(/\/+$/, '').replace(/\.git$/i, ''); // trailing slash THEN .git (handles `x.git/`)
  return s.toLowerCase();
}

/** Read every project-ref note (id = filename stem = the handle). Fail-soft → []. */
export function readProjectRefs(home) {
  const dir = refsDir(home);
  if (!existsSync(dir)) return [];
  const refs = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const id = idFromPath(f);
    let parsed;
    try { parsed = parse(readFileSync(join(dir, f), 'utf8'), { id }); } catch { continue; }
    if (parsed.ok && parsed.note && parsed.note.type === 'project-ref') refs.push(parsed.note);
  }
  return refs;
}

/** Write a project-ref note, filed by its handle (= the filename stem). The `handle`
 *  rides in frontmatter too (a stable id decoupled from path + remote). */
export function writeProjectRef(home, ref) {
  const handle = ref.handle || ref.id;
  if (!handle) throw new Error('project-ref needs a handle');
  mkdirSync(refsDir(home), { recursive: true });
  const note = { ...ref, type: 'project-ref', handle, id: handle };
  writeFileSync(refPath(home, handle), serialize(note));
  return handle;
}

/** Remove a project-ref by handle. No-op when absent. */
export function removeProjectRef(home, handle) {
  rmSync(refPath(home, handle), { force: true });
}

/** Find an existing ref that binds the same git remote (normalized). null = none. */
export function findRefByRemote(refs, remote) {
  const key = normalizeRemote(remote);
  if (!key) return null;
  return refs.find((r) => normalizeRemote(r.remote) === key) ?? null;
}

/** Find an existing local-only ref (no remote) by its resolved path. null = none. */
export function findRefByPath(refs, path) {
  if (!path) return null;
  return refs.find((r) => !r.remote && r.path === path) ?? null;
}

/** The registry's shared-module library = its ordinary modules (dirs with module.md).
 *  `refs/` carries no module.md, so it's never counted here. */
export function readLibraryModules(home) {
  return listModules(home);
}

// ── registry identity (project.md role:registry + identity) ───────────────────

const registryManifestPath = (home) => join(home, 'project.md');

/** Parse the registry's `project.md`, or null when absent/unparseable. Fail-soft. */
function readRegistryManifest(home) {
  const path = registryManifestPath(home);
  if (!existsSync(path)) return null;
  try {
    const { ok, note } = parse(readFileSync(path, 'utf8'), { id: 'project' });
    return ok ? note : null;
  } catch { return null; }
}

/** True when `home` is a `role: registry` repo. */
export function isRegistry(home) {
  const m = readRegistryManifest(home);
  return !!(m && m.role === 'registry');
}

/** The registry's stable, URL-independent identity, or null when not a registry. */
export function registryIdentity(home) {
  const m = readRegistryManifest(home);
  return m && m.role === 'registry' ? (m.identity ?? null) : null;
}

/** Mint a `role: registry` `project.md` carrying `identity` (caller supplies the slug
 *  so tests stay deterministic). Idempotent — an existing registry keeps its identity. */
export function mintRegistry(home, identity, { title = 'Registry' } = {}) {
  const existing = readRegistryManifest(home);
  if (existing && existing.role === 'registry' && existing.identity) return existing.identity;
  mkdirSync(home, { recursive: true });
  const note = {
    id: 'project', type: 'project', title, role: 'registry', identity,
    body: 'A registry — a binding manifest of project refs + a library of shared modules. Not an aggregate brain.',
  };
  writeFileSync(registryManifestPath(home), serialize(note));
  return identity;
}

/** A fresh, URL-independent registry identity (zero-dep). Random — pass an explicit
 *  slug to `mintRegistry` directly when a deterministic value is needed (tests). */
export function newIdentity() {
  return `reg-${randomBytes(6).toString('hex')}`;
}

// ── git helpers + cold-disk health (the per-ref stamp) ────────────────────────

const git = (args, cwd) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** The `origin` remote URL of the repo at `repoPath`, or null (no repo / no remote). */
export function gitRemoteUrl(repoPath) {
  return git(['remote', 'get-url', 'origin'], repoPath) || null;
}

const countDir = (dir, ext) => {
  try { return readdirSync(dir).filter((f) => (ext ? f.endsWith(ext) : true) && !f.startsWith('.')).length; }
  catch { return 0; }
};
const mtimeMs = (p) => { try { return statSync(p).mtimeMs; } catch { return 0; } };

/** A project's health from its `.zuzuu` home, cold (no daemon). Mirrors the web
 *  reader (web/src/server/project-health.ts) so the stamp matches Projects Home.
 *  Best-effort; missing → zeros, never throws. */
export function readHealth(home) {
  const empty = { modules: 0, notes: 0, pending: 0, guarded: false, lastActivityMs: 0 };
  if (!existsSync(home)) return empty;
  let entries;
  try { entries = readdirSync(home); } catch { return empty; }
  let modules = 0, notes = 0, pending = 0, guarded = false, last = mtimeMs(home);
  for (const name of entries) {
    const dir = join(home, name);
    let st; try { st = statSync(dir); } catch { continue; }
    if (!st.isDirectory() || !existsSync(join(dir, 'module.md'))) continue;
    modules++;
    if (name === 'guardrails') guarded = true;
    notes += countDir(join(dir, 'items'), '.md');
    pending += countDir(join(dir, 'staged'));
    last = Math.max(last, mtimeMs(dir));
  }
  return { modules, notes, pending, guarded, lastActivityMs: last };
}

// ── add / sync (the registry's write verbs over project-refs) ─────────────────

/** A stable handle slug for a project (from the remote basename, else the path basename). */
export function handleFor(remote, path) {
  const base = remote ? basename(normalizeRemote(remote)) : basename(path || '');
  return slugify(base || 'project');
}

/** Upsert a project-ref into the registry: capture the project's remote + health,
 *  dedupe by normalized remote (or realpath for local-only), and write the ref.
 *  Returns the ref's handle. `tracked` defaults to 'pinned' (an explicit add). */
export function addProject(registryHome, projectPath, { tracked = 'pinned' } = {}) {
  const remote = gitRemoteUrl(projectPath);
  const projectHome = homeDir(projectPath);
  const health = { ...readHealth(projectHome), capturedAt: Date.now() };
  const refs = readProjectRefs(registryHome);
  const existing = remote ? findRefByRemote(refs, remote) : findRefByPath(refs, projectPath);
  const handle = existing ? existing.id : handleFor(remote, projectPath);
  // never downgrade a pinned ref to auto on re-add
  const nextTracked = existing && existing.tracked === 'pinned' ? 'pinned' : tracked;
  writeProjectRef(registryHome, {
    handle, remote: remote || undefined, path: projectPath,
    tracked: nextTracked, portable: !!remote,
    groups: existing?.groups ?? [], health,
  });
  return handle;
}

/** Refresh every ref's health stamp, then commit the registry repo (one tidy commit).
 *  Returns `{ synced, committed }`. Commit is skipped when nothing changed. */
export function syncRegistry(registryHome, { now = Date.now() } = {}) {
  const refs = readProjectRefs(registryHome);
  for (const ref of refs) {
    const health = { ...readHealth(homeDir(ref.path)), capturedAt: now };
    writeProjectRef(registryHome, { ...ref, handle: ref.id, health });
  }
  const repoPath = registryHome.replace(/\/\.zuzuu$/, '');
  git(['add', '.zuzuu'], repoPath);
  const dirty = git(['status', '--porcelain', '.zuzuu'], repoPath);
  let committed = false;
  if (dirty) { git(['commit', '-m', `chore(registry): sync ${refs.length} projects`, '--', '.zuzuu'], repoPath); committed = true; }
  return { synced: refs.length, committed };
}

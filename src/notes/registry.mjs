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

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parse, serialize, idFromPath } from './note.mjs';
import { listModules } from './module.mjs';

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

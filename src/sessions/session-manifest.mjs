// zuzuu/sessions/session-manifest.mjs — the portable SESSION MANIFEST (Wave C, L4).
//
// A manifest is the durable, content-addressed DEFINITION of a session: enough
// to identify, understand, and (Wave C restore) reconstitute it — host, state,
// git base/branch/commit, the capture/trace pointer, counts, generation. It is
// the session-level analogue of the per-module generation lockfile, and the
// portability UNIT the cloud waves (E/F/G) will move across machines.
//
// content-addressing: a sha256 over the canonical (sorted-key) JSON of the
// STABLE definition only — volatile runtime context (whether the worktree dir
// currently exists, derived span counts) is attached OUTSIDE the hash so the
// hash means "this session's definition", not "this machine right now".
//
// Fail-soft, zero-dep: pure data from the tracked index + labels + git argv.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readIndex } from '../kernel/session.mjs'; // 8b: re-pointed off v1 core onto the kernel
import { readSessionLabels } from './labels.mjs';
import { mainBranch, sessionBranchName, defaultTitle } from './session-git.mjs';
import { branchExists, git } from './git.mjs';
import { worktreePath, openSessionWorktree, pruneWorktrees } from './session-worktree.mjs';

const MANIFEST_VERSION = 1;

/** The git-tracked home for session manifests (the durable session definitions). */
function manifestsDir(cwd) {
  const root = git(['rev-parse', '--show-toplevel'], cwd).out || cwd;
  return join(root, '.zuzuu', 'manifests');
}
const manifestPath = (cwd, id) => join(manifestsDir(cwd), `${id}.json`);

const matchSession = (sessions, idArg) => {
  const exact = sessions.filter((s) => s.id === idArg);
  return (exact.length ? exact : sessions.filter((s) => String(s.id).startsWith(idArg)))[0] ?? null;
};

/** Recursively sort object keys so JSON.stringify is canonical (stable hashing). */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonical(value[k]);
    return out;
  }
  return value;
}

const sha256 = (obj) => createHash('sha256').update(JSON.stringify(canonical(obj))).digest('hex');

/**
 * Build a session manifest for `idArg` (full id or unique prefix), or null when
 * no session matches. The returned object's `contentHash` covers `definition`
 * only; `worktree` (and any derived counts) ride alongside as runtime context.
 */
export function buildSessionManifest(cwd, idArg) {
  if (!idArg) return null;
  let s;
  try {
    s = matchSession(readIndex(cwd).sessions, idArg);
  } catch {
    return null;
  }
  if (!s) return null;

  const labels = (() => { try { return readSessionLabels(cwd); } catch { return {}; } })();
  const base = (() => { try { return mainBranch(cwd); } catch { return null; } })() || null;
  const branch = s.git?.branch || sessionBranchName(s.id);
  // commit: prefer the recorded one; else the branch tip if the branch is live
  let commit = s.git?.commit ?? null;
  if (!commit) {
    try { if (branchExists(cwd, branch)) commit = git(['rev-parse', branch], cwd).out || null; } catch { /* fail-soft */ }
  }
  const title = labels[s.id] || defaultTitle(branch);

  // The STABLE definition — the only thing the content hash covers.
  const definition = {
    version: MANIFEST_VERSION,
    sessionId: s.id,
    host: s.host ?? null,
    title,
    state: s.status ?? null,
    startedAt: s.startedAt ?? null,
    endedAt: s.endedAt ?? null,
    durationMs: s.durationMs ?? 0,
    git: { base, branch, commit },
    trace: { ref: s.traceRef ?? null },
    counts: s.counts ?? { turns: 0, tools: 0, errors: 0 },
    generation: s.generation ?? null,
    ...(s.ptyId ? { ptyId: s.ptyId } : {}),
  };

  // Runtime context (NOT hashed): does this session's worktree exist here now?
  const wtPath = (() => { try { return worktreePath(cwd, s.id); } catch { return null; } })();
  const worktree = wtPath ? { path: wtPath, present: existsSync(wtPath) } : null;

  return { ...definition, contentHash: sha256(definition), worktree };
}

/**
 * Persist a session's manifest to `.zuzuu/manifests/<id>.json` (git-tracked —
 * it's the durable definition). Returns { ok, path, contentHash } or a quiet
 * { ok:false } for an unknown id / write trouble.
 */
export function writeSessionManifest(cwd, idArg) {
  try {
    const m = buildSessionManifest(cwd, idArg);
    if (!m) return { ok: false, reason: 'no-session' };
    mkdirSync(manifestsDir(cwd), { recursive: true });
    const path = manifestPath(cwd, m.sessionId);
    writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
    return { ok: true, path, contentHash: m.contentHash };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** Read a persisted manifest by full id, or null if none/unreadable. */
export function readSessionManifest(cwd, id) {
  try {
    const p = manifestPath(cwd, id);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Ids of all persisted manifests (sorted). */
export function listSessionManifests(cwd) {
  try {
    return readdirSync(manifestsDir(cwd))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .sort();
  } catch {
    return [];
  }
}

/**
 * RESTORE: reconstitute a session's working state on this machine from its
 * manifest (or the live record) — re-create its worktree on its branch. If the
 * branch is gone but the recorded commit is reachable, recreate the branch at
 * that commit first; if neither resolves, fail soft.
 * Returns { ok, branch, worktree, recreatedBranch? } or { ok:false, reason }.
 */
export function restoreSession(cwd, idArg) {
  try {
    const persisted = readSessionManifest(cwd, idArg);
    const m = persisted || buildSessionManifest(cwd, idArg);
    if (!m) return { ok: false, reason: 'no-session' };
    const id = m.sessionId;
    const branch = m.git?.branch || sessionBranchName(id);
    const commit = m.git?.commit ?? null;

    let recreatedBranch = false;
    if (!branchExists(cwd, branch)) {
      // recreate the branch at the recorded commit if it's reachable here
      if (!commit) return { ok: false, reason: 'no-branch-no-commit' };
      const verify = git(['rev-parse', '-q', '--verify', `${commit}^{commit}`], cwd);
      if (!verify.ok) return { ok: false, reason: 'commit-unavailable' };
      const made = git(['branch', branch, commit], cwd);
      if (!made.ok) return { ok: false, reason: made.err || 'branch-create-failed' };
      recreatedBranch = true;
    }
    // drop any stale worktree bookkeeping (dir removed but git still lists it)
    // so a re-open actually re-creates the dir rather than "resuming" a ghost
    pruneWorktrees(cwd);
    // openSessionWorktree resumes onto the (now-existing) branch
    const opened = openSessionWorktree(cwd, id);
    if (!opened.ok) return { ok: false, reason: opened.reason || 'worktree-open-failed' };
    return { ok: true, branch, worktree: opened.worktree, ...(recreatedBranch ? { recreatedBranch } : {}) };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

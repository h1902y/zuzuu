// zuzuu/commands/sessions/diff.mjs — session diff: "what changed" (the git-native wedge).
//
// Every session is a `zz/session-*` branch off mainBranch (squash-merged on end).
// "What this session changed" resolves to a base/tip range:
//   • live/leftover branch exists → mainBranch...branch (three-dot: what the
//     session introduced since it diverged) — the reliable, high-value case;
//   • merged/past (branch gone) → best-effort from the recorded git.commit
//     (`git show <commit>`); unresolvable → { available:false }.
// All git via the fail-soft argv `git()` wrapper — never throws.
//
// W2b (trace-linked diff): each changed file → the LAST tool node whose
// toolInput mentions that path, bridging the git diff to the captured transcript.

import { readIndex } from '../../core/store.mjs';
import { git, branchExists } from '../../sessions/git.mjs';
import { mainBranch, sessionBranchName } from '../../sessions/session-git.mjs';
import { matchSession, sessionContentData } from './data.mjs';

const MAX_FILE_DIFF = 200_000; // size cap for one file's unified diff

/** Resolve a session record to a diff range, or null when none is available. */
function resolveDiffRange(cwd, s) {
  const branch = sessionBranchName(s.id);
  if (branchExists(cwd, branch)) {
    const base = mainBranch(cwd);
    if (base && base !== branch) return { kind: 'branch', base, tip: branch };
  }
  const commit = s.git?.commit;
  if (commit && git(['rev-parse', '-q', '--verify', `${commit}^{commit}`], cwd).ok) {
    return { kind: 'commit', base: `${commit}~1`, tip: commit };
  }
  return null;
}

/** git args for a numstat/name-status read over a resolved range. */
function diffArgs(range, flag) {
  return range.kind === 'branch'
    ? ['diff', flag, `${range.base}...${range.tip}`]
    : ['show', flag, '--format=', range.tip];
}

function parseNumstat(out) {
  const map = new Map();
  for (const line of (out || '').split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [a, d, ...rest] = parts;
    const path = rest.join('\t');
    map.set(path, { additions: a === '-' ? 0 : Number(a) || 0, deletions: d === '-' ? 0 : Number(d) || 0 });
  }
  return map;
}

function parseNameStatus(out) {
  const map = new Map();
  for (const line of (out || '').split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = (parts[0] || 'M')[0]; // R100/C75 → R/C
    const path = parts[parts.length - 1];
    if (path) map.set(path, status);
  }
  return map;
}

/** `{ sessionId, available, base?, tip?, totals:{files,additions,deletions}, files:[{path,status,additions,deletions}] }` */
export function sessionDiffData(cwd, idArg) {
  if (!idArg) return null;
  const s = matchSession(readIndex(cwd).sessions, idArg);
  if (!s) return null;
  const empty = { sessionId: s.id, available: false, files: [], totals: { files: 0, additions: 0, deletions: 0 } };
  const range = resolveDiffRange(cwd, s);
  if (!range) return empty;
  try {
    const num = parseNumstat(git(diffArgs(range, '--numstat'), cwd).out);
    const names = parseNameStatus(git(diffArgs(range, '--name-status'), cwd).out);
    const files = [];
    let additions = 0;
    let deletions = 0;
    for (const [path, c] of num) {
      files.push({ path, status: names.get(path) ?? 'M', additions: c.additions, deletions: c.deletions });
      additions += c.additions;
      deletions += c.deletions;
    }
    for (const [path, status] of names) {
      if (!num.has(path)) files.push({ path, status, additions: 0, deletions: 0 });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return { sessionId: s.id, available: true, base: range.base, tip: range.tip, totals: { files: files.length, additions, deletions }, files };
  } catch {
    return empty;
  }
}

/** `{ sessionId, path, diff }` — the unified diff for ONE file, size-capped. */
export function sessionFileDiffData(cwd, idArg, path) {
  if (!idArg || !path) return null;
  const s = matchSession(readIndex(cwd).sessions, idArg);
  if (!s) return null;
  const range = resolveDiffRange(cwd, s);
  if (!range) return { sessionId: s.id, path, diff: '' };
  try {
    const args = range.kind === 'branch'
      ? ['diff', `${range.base}...${range.tip}`, '--', path]
      : ['show', '--format=', range.tip, '--', path];
    let diff = git(args, cwd).out || '';
    let truncated = false;
    if (diff.length > MAX_FILE_DIFF) {
      diff = diff.slice(0, MAX_FILE_DIFF);
      truncated = true;
    }
    return { sessionId: s.id, path, diff, ...(truncated ? { truncated: true } : {}) };
  } catch {
    return { sessionId: s.id, path, diff: '' };
  }
}

const basename = (p) => String(p ?? '').split('/').pop() ?? '';

/**
 * Pure: map each changed file path to the LAST tool node that wrote it.
 * @param {Array<{kind,label,ts,toolInput?}>} nodes  DISPLAY content nodes (sessionContentData shape)
 * @param {string[]} paths  the changed file paths (from sessionDiffData)
 * @returns {Record<string, { turn: string, ts: string }>}  path → writing turn (absent when unmatched)
 */
export function fileAuthorsFromNodes(nodes, paths) {
  const out = {};
  if (!Array.isArray(nodes) || !Array.isArray(paths) || !paths.length) return out;
  // Walk in order; later tool nodes overwrite earlier ones for the same path.
  for (const n of nodes) {
    if (!n || n.kind !== 'tool') continue;
    const input = typeof n.toolInput === 'string' ? n.toolInput : '';
    if (!input) continue;
    for (const path of paths) {
      if (typeof path !== 'string' || !path) continue;
      const base = basename(path);
      if (input.includes(path) || (base && input.includes(base))) {
        out[path] = { turn: n.label || 'tool', ts: n.ts ?? '' };
      }
    }
  }
  return out;
}

/**
 * Pure-ish: { sessionId, authors } where authors maps each changed file to the
 * turn that wrote it. Loads the changed-file paths (sessionDiffData) + the
 * ordered content nodes (sessionContentData) and applies fileAuthorsFromNodes.
 * Fail-soft: unknown id → null; no diff / no content → { authors: {} }, never throws.
 * @param {string} cwd
 * @param {string} idArg  session id or unique prefix
 * @param {{transcripts?: Array<object>, paths?: string[]}} [opts]  injectable for tests
 * @returns {{ sessionId: string, authors: Record<string, {turn,ts}> } | null}
 */
export function sessionFileAuthorsData(cwd, idArg, { transcripts, paths } = {}) {
  if (!idArg) return null;
  const s = matchSession(readIndex(cwd).sessions, idArg);
  if (!s) return null;
  let authors = {};
  try {
    // Changed paths: injected (tests) or resolved from the session's diff.
    let changed = paths;
    if (!Array.isArray(changed)) {
      const diff = sessionDiffData(cwd, s.id);
      changed = diff && diff.available ? diff.files.map((f) => f.path) : [];
    }
    if (changed.length) {
      const content = sessionContentData(cwd, s.id, { transcripts });
      authors = fileAuthorsFromNodes(content ? content.nodes : [], changed);
    }
  } catch {
    authors = {}; // fail-soft
  }
  return { sessionId: s.id, authors };
}

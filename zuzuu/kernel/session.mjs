// zuzuu/kernel/session.mjs — the session record + its lifecycle, in the kernel.
//
// what: the session index (`.zuzuu/sessions.json`, tracked) and the lifecycle
//       state machine (opening→active→completed|abandoned|crashed; captured =
//       post-hoc). A session ≡ a conversation ≡ a git branch; this is its
//       durable, diff-friendly record (each entry links to a git commit).
// why:  the foundation the v2 session layer (git branch / worktree / manifest)
//       and the live hook sit on. Reabsorbed from v1's core/{store,session} —
//       MINUS the OTLP trace fields (traceId/traceRef): v2 mines transcripts
//       directly, so there are no trace blobs to point at.
// how:  an atomic-write JSON index keyed by id; a frozen state machine with
//       guarded transitions. Zero-dep; tolerant (a corrupt index reads empty).

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { paths } from './store.mjs';

const INDEX_VERSION = 1;

// ── the lifecycle state machine ───────────────────────────────────────────────

export const SessionState = Object.freeze({
  OPENING: 'opening',     // lifecycle signal fired; session born
  ACTIVE: 'active',       // turns/tools flowing
  COMPLETED: 'completed', // clean end (Stop / explicit close)
  ABANDONED: 'abandoned', // no activity past the liveness window; reconciled
  CRASHED: 'crashed',     // process/terminal died mid-session; reconciled
  CAPTURED: 'captured',   // post-hoc snapshot; lifecycle not tracked live
});

const TERMINAL = new Set([SessionState.COMPLETED, SessionState.ABANDONED, SessionState.CRASHED, SessionState.CAPTURED]);
const TRANSITIONS = {
  [SessionState.OPENING]: [SessionState.ACTIVE, SessionState.CRASHED, SessionState.ABANDONED],
  [SessionState.ACTIVE]: [SessionState.COMPLETED, SessionState.ABANDONED, SessionState.CRASHED],
  [SessionState.COMPLETED]: [], [SessionState.ABANDONED]: [], [SessionState.CRASHED]: [], [SessionState.CAPTURED]: [],
};

export const isTerminal = (state) => TERMINAL.has(state);
export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

/** Apply a lifecycle transition, throwing on an illegal one. Returns a new record. */
export function transition(session, to, at = session.endedAt) {
  if (!canTransition(session.status, to)) throw new Error(`illegal session transition: ${session.status} -> ${to}`);
  const endedAt = isTerminal(to) ? at : session.endedAt;
  const durationMs = endedAt && session.startedAt ? Date.parse(endedAt) - Date.parse(session.startedAt) : session.durationMs;
  return { ...session, status: to, endedAt, durationMs };
}

/**
 * Build a session record (the index entry). `id` + `host` required; extra fields
 * (branch, baseline, previousSession, …) are preserved — the session-git layer
 * adds its own. No OTLP fields (the trace layer is gone).
 */
export function makeSession({ id, host, status = SessionState.CAPTURED, startedAt = null, endedAt = null, git = { commit: null, branch: null }, counts = { turns: 0, tools: 0, errors: 0 }, generation = null, ...rest }) {
  if (!id) throw new Error('makeSession: id required');
  if (!host) throw new Error('makeSession: host required');
  if (!Object.values(SessionState).includes(status)) throw new Error(`makeSession: unknown status ${status}`);
  const durationMs = startedAt && endedAt ? Date.parse(endedAt) - Date.parse(startedAt) : 0;
  return { id: String(id), host, status, startedAt, endedAt, durationMs, git, counts, generation, ...rest };
}

// ── the index (.zuzuu/sessions.json, tracked) ─────────────────────────────────

/** Read the session index; a missing/corrupt file reads as empty (tolerant). */
export function readIndex(cwd = process.cwd()) {
  const { index } = paths(cwd);
  if (!existsSync(index)) return { version: INDEX_VERSION, sessions: [] };
  try {
    const data = JSON.parse(readFileSync(index, 'utf8'));
    return { version: data.version ?? INDEX_VERSION, sessions: Array.isArray(data.sessions) ? data.sessions : [] };
  } catch { return { version: INDEX_VERSION, sessions: [] }; }
}

/** Atomic write (tmp + rename) so a concurrent reader never sees a half file. */
function writeIndex(idx, cwd = process.cwd()) {
  const { index } = paths(cwd);
  mkdirSync(dirname(index), { recursive: true });
  const sessions = [...idx.sessions].sort((a, b) => Date.parse(b.startedAt || 0) - Date.parse(a.startedAt || 0));
  const tmp = `${index}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: INDEX_VERSION, sessions }, null, 2) + '\n');
  renameSync(tmp, index);
}

/** Insert-or-replace a record by (id, host); persist. Returns the record. */
export function upsertSession(record, cwd = process.cwd()) {
  const idx = readIndex(cwd);
  const sessions = idx.sessions.filter((s) => !(s.id === record.id && s.host === record.host));
  sessions.push(record);
  writeIndex({ ...idx, sessions }, cwd);
  return record;
}

/** Look up a session by id (optionally scoped by host). */
export function getSession(id, cwd = process.cwd(), host = null) {
  return readIndex(cwd).sessions.find((s) => s.id === id && (!host || s.host === host)) ?? null;
}

/** Remove a session by id (optionally scoped by host); persist. */
export function removeSession(id, cwd = process.cwd(), host = null) {
  const idx = readIndex(cwd);
  const sessions = idx.sessions.filter((s) => !(s.id === id && (!host || s.host === host)));
  if (sessions.length !== idx.sessions.length) writeIndex({ ...idx, sessions }, cwd);
  return idx.sessions.length - sessions.length;
}

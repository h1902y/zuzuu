// src/grow/log.mjs — the module event log.
//
// what: append-only, schema-bound JSONL recording what happened in a module —
//       mutations (create/update/delete) and runs (each execution).
// why:  a note never records its own outcomes (it stays pure definition); the
//       module does. This log is also `enhance`'s feedback edge — it mines what
//       actually got used/run, not just what was said.
// how:  split by durability — log.jsonl (mutations, git-TRACKED, durable
//       provenance) + runs.jsonl (runs, git-IGNORED, local telemetry). Each
//       event is one validated JSON line. Fail-soft: a logging failure never
//       breaks the operation it records.

import { existsSync, appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const MUTATIONS = new Set(['create', 'update', 'delete', 'deprecate']);
const RUNS = new Set(['run', 'query']);

const logPath = (home, module) => join(home, module, 'log.jsonl');
const runsPath = (home, module) => join(home, module, 'runs.jsonl');

/** Append one event to the right file by kind. Fail-soft — returns ok/false. */
export function append(home, module, event) {
  if (!event || typeof event.event !== 'string') return false;
  const file = MUTATIONS.has(event.event) ? logPath(home, module)
    : RUNS.has(event.event) ? runsPath(home, module)
      : null;
  if (!file) return false;
  try {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify(event) + '\n', 'utf8');
    return true;
  } catch {
    return false; // logging must never break the operation it records
  }
}

/** Convenience: a run event with the normalized result shape. */
export function logRun(home, module, note, { inputs = {}, exitCode, success, ts, actor = 'agent', session = null } = {}) {
  return append(home, module, { event: 'run', ts: ts ?? null, note, actor, session, inputs, exitCode, success });
}

/** Convenience: a mutation event. */
export function logMutation(home, module, kind, note, extra = {}) {
  if (!MUTATIONS.has(kind)) return false;
  return append(home, module, { event: kind, ts: extra.ts ?? null, note, actor: extra.actor ?? 'human', ...extra });
}

/** Read events from a log file (mutations | runs). Fail-soft → []. */
export function read(home, module, which = 'runs') {
  const file = which === 'mutations' ? logPath(home, module) : runsPath(home, module);
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip a bad line, keep the rest */ }
  }
  return out;
}

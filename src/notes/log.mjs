// src/notes/log.mjs — the module event log (Data layer).
//
// what: append-only, schema-bound JSONL recording what happened in a module —
//       mutations (create/update/delete) and runs (each execution). A durable
//       artifact of a Project (Layer 1), not loop machinery — so `use/` may append
//       a run here without crossing into the write path (the log is data).
// why:  a note never records its own outcomes (it stays pure definition); the
//       module does. This log is also `observe`'s feedback edge — it mines what
//       actually got used/run, not just what was said.
// how:  split by durability — log.jsonl (mutations, git-TRACKED, durable
//       provenance) + runs.jsonl (runs, git-IGNORED, local telemetry). Each
//       event is one validated JSON line. Fail-soft: a logging failure never
//       breaks the operation it records.
//
// SECRETS REDACTION (safety floor, §I rung 3): runs.jsonl is local telemetry, not a
// vault — but a run's `inputs` (ZZ_* env values, see use/act.mjs) can carry a key or
// token, and this log is exactly the sort of file that gets pasted into a bug report
// or grepped by a future agent. `logRun` redacts a COPY of inputs before writing —
// the child process still gets the real, unredacted values (use/act.mjs's env build
// is untouched); only the logged text changes.

import { existsSync, appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ephemeraDirFromHome } from './store.mjs';

const MUTATIONS = new Set(['create', 'update', 'delete', 'deprecate']);
const RUNS = new Set(['run', 'query']);

const logPath = (home, module) => join(home, module, 'log.jsonl');
const runsPath = (home, module) => join(home, module, 'runs.jsonl');

// A key that LOOKS like a secret is redacted regardless of its value — cheap,
// name-shaped heuristic, matches "apiKey", "AUTH_TOKEN", "db_password", etc.
const SECRET_KEY_RE = /(key|token|secret|password|passwd|credential|auth)/i;
export const REDACTED = '‹redacted›';

/**
 * Pure: redact an inputs object for the LOGGED copy only. Two independent triggers:
 * (1) a key matching SECRET_KEY_RE is redacted regardless of its value; (2) a value
 * that EXACTLY matches one of `secretValues` (loaded from `.zuzuu/secrets.env`, see
 * `readSecretValues`) is redacted regardless of its key — catches a secret riding in
 * under an innocuous name (e.g. `inputs.lead_email_password`'s twin, a raw value
 * passed as `inputs.x`). Never mutates `inputs`; returns a new object.
 * NIT (audit 2026-07-03): top-level only — a secret nested at `inputs.config.token`
 * is not matched. Harmless today because `use/act.mjs` flattens inputs to
 * `ZZ_<k>=String(v)` before spawning, so inputs are always flat scalars in practice;
 * revisit if/when typed/structured step inputs land.
 */
export function redactInputs(inputs, secretValues = []) {
  if (!inputs || typeof inputs !== 'object') return inputs;
  const values = new Set(secretValues.filter((v) => v !== '' && v != null).map(String));
  const out = {};
  for (const [k, v] of Object.entries(inputs)) {
    out[k] = SECRET_KEY_RE.test(k) || values.has(String(v)) ? REDACTED : v;
  }
  return out;
}

/**
 * Read secret VALUES (never names) from `<ephemera>/secrets.env` (KEY=value lines,
 * one per line, gitignored — §I.1.3's secrets doctrine: notes reference names,
 * values resolve at run time). `<ephemera>` is `ephemeraDirFromHome(home)` — in
 * classic mode `home` already IS `.zuzuu`, so this coincides with the old
 * `<home>/secrets.env`; in root-mode `home` is the repo root, so this resolves to
 * `<root>/.zuzuu/secrets.env` (gitignored) instead of the un-gitignored
 * `<root>/secrets.env` a bare `join(home, ...)` would have produced. Fail-soft → []
 * when the file is missing, empty, or unreadable — a run must never fail because its
 * secrets file couldn't be read for redaction purposes (the child's own env read, in
 * use/act.mjs, is separate and untouched by this).
 */
export function readSecretValues(home) {
  const path = join(ephemeraDirFromHome(home), 'secrets.env');
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => { const i = line.indexOf('='); return i === -1 ? null : line.slice(i + 1).trim(); })
      .filter((v) => v);
  } catch {
    return [];
  }
}

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

/** Convenience: a run event with the normalized result shape. `timedOut` (safety
 *  floor, §I rung 3) rides as an explicit marker on the event when the run hit its
 *  timeout — omitted (not even `false`) on an ordinary run, so existing readers of
 *  runs.jsonl see no shape change. `inputs` is redacted (see `redactInputs` above)
 *  before it is written — the LOGGED copy only; the run itself already happened with
 *  the real values. */
export function logRun(home, module, note, { inputs = {}, exitCode, success, ts, actor = 'agent', session = null, timedOut } = {}) {
  const safeInputs = redactInputs(inputs, readSecretValues(home));
  const event = { event: 'run', ts: ts ?? null, note, actor, session, inputs: safeInputs, exitCode, success };
  if (timedOut) event.timedOut = true;
  return append(home, module, event);
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

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
// SECRETS REDACTION (safety floor, §I rung 3, extended for §J.3/§J.5 declared secrets):
// runs.jsonl is local telemetry, not a vault — but a run's `inputs` (ZZ_* env values,
// see use/act.mjs) can carry a key or token, and this log is exactly the sort of file
// that gets pasted into a bug report or grepped by a future agent. `logRun` redacts a
// COPY of inputs before writing — the child process still gets the real, unredacted
// values (use/act.mjs's env build is untouched); only the logged text changes. The
// redaction VALUE set is TWO sources: the dev-fallback `secrets.env` file
// (`readSecretValues`) and, since §J's declared-secret resolution, whatever a tool's
// OWN `secrets: [name]` declaration just resolved to in `process.env`
// (`readDeclaredSecretEnvValues`, threaded in as `logRun`'s `secretNames` option) — a
// declared secret's real value is masked here even if it rides in under an unrelated
// input key, never only by the key-shape heuristic.

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
 * Parse `<ephemera>/secrets.env` (KEY=value lines, one per line, gitignored) into
 * `[key, value]` pairs — the ONE parser both `readSecretValues` (redaction, values
 * only) and `readSecretsFileValue` (§J.5's dev-fallback `resolves_from:
 * secrets-file` reader, one named key) read. `<ephemera>` is `ephemeraDirFromHome(home)`
 * — in classic mode `home` already IS `.zuzuu`; in root-mode `home` is the repo root,
 * so this resolves to `<root>/.zuzuu/secrets.env` (gitignored), never the
 * un-gitignored `<root>/secrets.env` a bare `join(home, ...)` would produce.
 * Fail-soft → [] when the file is missing, empty, or unreadable.
 */
function parseSecretsFile(home) {
  const path = join(ephemeraDirFromHome(home), 'secrets.env');
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => { const i = line.indexOf('='); return i === -1 ? null : [line.slice(0, i).trim(), line.slice(i + 1).trim()]; })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Read secret VALUES (never names) from `<ephemera>/secrets.env` — §I.1.3's secrets
 * doctrine: notes reference names, values resolve at run time. A run must never fail
 * because its secrets file couldn't be read for redaction purposes (the child's own
 * env read, in use/act.mjs, is separate and untouched by this).
 */
export function readSecretValues(home) {
  return parseSecretsFile(home).map(([, v]) => v).filter((v) => v);
}

/** Read ONE named value from the `.zuzuu/secrets.env` dev-fallback file (§J.5:
 *  `resolves_from: secrets-file` — kept ONLY as a local-dev convenience, never the
 *  primary host mechanism; see docs/guide/Secrets.md). `undefined` when the file is
 *  absent or the key isn't in it — never throws. */
export function readSecretsFileValue(home, name) {
  const hit = parseSecretsFile(home).find(([k]) => k === name);
  return hit ? hit[1] : undefined;
}

/** Read secret VALUES the host already materialized into `process.env` for a list of
 *  DECLARED secret NAMES (§J.5: `resolves_from: env`/`fly` both bottom out in reading
 *  `process.env[name]` — fly injects at boot, so there's no separate "get" call).
 *  Used ONLY for redaction (the injection site's own record of what it just put into a
 *  run's env — see act.mjs) — never a general env scan. Fail-soft, never throws. */
export function readDeclaredSecretEnvValues(names = []) {
  if (!Array.isArray(names)) return [];
  return names
    .map((n) => (typeof n === 'string' ? process.env[n] : undefined))
    .filter((v) => v !== '' && v != null);
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
 *  runs.jsonl see no shape change. `via` (§I rung 1, workflow COMPOSITION —
 *  `use/workflow.mjs`) is the composing workflow's `module:id` when this run was
 *  invoked as a note-ref step (the IMMEDIATE parent, not the composition root) —
 *  omitted on every non-composed run, same "no shape change" treatment as `timedOut`,
 *  so the runs-miner (§I rung 2) can later attribute a composed failure to the
 *  workflow that triggered it without every existing reader having to learn a new
 *  always-present field. `inputs` is redacted (see `redactInputs` above) before it is
 *  written — the LOGGED copy only; the run itself already happened with the real
 *  values. `secretNames` (§J.3/§J.5, optional — a tool note's OWN `secrets: [name]`
 *  declaration list, threaded by act.mjs) extends the value-redaction set with
 *  whatever those names currently resolve to in `process.env` — "redact at the
 *  INJECTION site" (transformation defeats post-hoc masking): the values that just
 *  entered THIS run's env are exactly what must never survive into its log entry,
 *  even under an unrelated, innocuous input key. Omitted/empty ⇒ no change from before. */
export function logRun(home, module, note, { inputs = {}, exitCode, success, ts, actor = 'agent', session = null, timedOut, via, secretNames = [] } = {}) {
  const secretValues = [...readSecretValues(home), ...readDeclaredSecretEnvValues(secretNames)];
  const safeInputs = redactInputs(inputs, secretValues);
  const event = { event: 'run', ts: ts ?? null, note, actor, session, inputs: safeInputs, exitCode, success };
  if (timedOut) event.timedOut = true;
  if (via) event.via = via;
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

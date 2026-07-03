// src/grow/edit.mjs — scoped writes: patch one field · append to the body.
//
// what: small, legible edits to one existing note — set a single frontmatter key
//       (`patch`) or append a line to the body (`append`) — instead of rewriting
//       the whole envelope. A smaller diff is a more reviewable diff (ACI ergonomics).
// why:  full-note CRUD makes the reviewer read a whole new version to find a one-key
//       change. Scoped edits keep the intent legible. Human-initiated; each lands as
//       one generation (sugar over evolve's update — same merge + mint, no new path).
// how:  thin wrappers over evolve(update) on an existing note. Zero-dep, fail-soft.

import { existsSync } from 'node:fs';
import { itemPath } from '../notes/store.mjs';
import { readManifest } from '../notes/module.mjs';
import { readNote } from '../notes/repo.mjs';
import { evolve } from './evolve.mjs';
import { commit } from './commit.mjs';

// a CLI value is text; coerce JSON (numbers/booleans/lists) but keep a plain string
const coerce = (v) => { try { return JSON.parse(v); } catch { return v; } };

// envelope keys that are strings BY CONTRACT — a blind JSON.parse once turned
// `note set m id title 5` into a NUMBER title.
const STRING_KEYS = new Set(['title', 'status']);

/** Coerce a CLI text value SCHEMA-AWARE: a column the module declares coerces by its
 *  declared FieldType; a known string envelope key stays a string; everything else
 *  keeps the permissive JSON heuristic (numbers/booleans/lists still work). */
export function coerceForField(home, module, key, value) {
  const f = (readManifest(home, module).fields ?? []).find((x) => x?.name === key);
  if (f) {
    const s = String(value);
    switch (f.type) {
      case 'number': { const n = Number(s); return Number.isFinite(n) && s.trim() !== '' ? n : value; }
      case 'bool': {
        const low = s.toLowerCase();
        return ['true', 'yes', '1'].includes(low) ? true : ['false', 'no', '0'].includes(low) ? false : value;
      }
      case 'multi': {
        try { const j = JSON.parse(s); if (Array.isArray(j)) return j; } catch { /* not JSON */ }
        return s.split(',').map((x) => x.trim()).filter(Boolean);
      }
      default: return s; // text · longtext · select · link · date — strings stay strings
    }
  }
  if (STRING_KEYS.has(key)) return String(value);
  return coerce(value);
}

/** Set ONE frontmatter field on an existing note → one generation. */
export function patchNote(home, module, id, key, value, actor = 'operator') {
  if (!existsSync(itemPath(home, module, id))) return { ok: false, error: `no note '${module}:${id}'` };
  if (key === 'id' || key === 'type') return { ok: false, error: `'${key}' is structural — not patchable` };
  return evolve(home, module, { id: `patch-${id}`, op: 'update', target: id, change: { [key]: coerceForField(home, module, key, value) } }, actor);
}

/** Append text to an existing note's body → one generation. */
export function appendNote(home, module, id, text, actor = 'operator') {
  const cur = readNote(home, module, id); // the persistence ring — not an open-coded parse(readFileSync(itemPath))
  if (!cur) return { ok: false, error: `no note '${module}:${id}'` };
  const body = [cur.body, text].filter((s) => s && s.trim()).join('\n');
  return evolve(home, module, { id: `append-${id}`, op: 'update', target: id, change: { body } }, actor);
}

// ── the operator lane: direct row create/delete ──────────────────────────────
// The human building their own app gets INSTANT CRUD — still through the one
// write boundary (validated, logged, minted), never exposed to the agent
// (the CLI rows are agentInvokable:false; the agent's channel stays stage→review).

// `default: now` is a SENTINEL, DATE columns only: resolved at FILL time (here, not
// the floor — the floor fills title/status unconditionally; this is a declared column's
// schema default, a different concern) to today's ISO date (YYYY-MM-DD). The manifest
// keeps the symbolic `now` forever — only the value landing in the row resolves. Any
// other column type treats the string `now` as a literal (no magic outside dates).
function resolveDefault(f) {
  if (f.type === 'date' && f.default === 'now') return new Date().toISOString().slice(0, 10);
  return f.default;
}

// Fill absent declared columns from the schema's `default`s — the row lands complete.
function withDefaults(home, module, change) {
  const out = { ...change };
  for (const f of readManifest(home, module).fields ?? []) {
    if (f?.name && f.default !== undefined && (out[f.name] === undefined || out[f.name] === '')) out[f.name] = resolveDefault(f);
  }
  return out;
}

/** Create a note DIRECTLY → one generation. `force` replaces an existing note
 *  (the upsert); without it an existing id is an error, not a silent overwrite. */
export function createNote(home, module, id, change = {}, { actor = 'operator', force = false } = {}) {
  if (!force && existsSync(itemPath(home, module, id))) {
    return { ok: false, error: `note '${module}:${id}' already exists (note set edits · --force replaces)` };
  }
  return evolve(home, module, { id: `create-${id}`, op: 'create', target: id, change: withDefaults(home, module, change) }, actor);
}

/** Delete a note DIRECTLY → one generation. (Referrers keep their edges — `zz check`
 *  will flag them; `note fold` is the merge-aware alternative.) */
export function deleteNote(home, module, id, actor = 'operator') {
  if (!existsSync(itemPath(home, module, id))) return { ok: false, error: `no note '${module}:${id}'` };
  return evolve(home, module, { id: `delete-${id}`, op: 'delete', target: id }, actor);
}

/** Create MANY rows in ONE transaction → one generation (the batch/import path).
 *  All-or-nothing: any invalid row reverts the whole batch. */
export function createNotes(home, module, rows, { actor = 'operator', force = false } = {}) {
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: 'batch needs a non-empty array of rows' };
  if (rows.some((r) => !r || typeof r !== 'object' || !r.id)) return { ok: false, error: 'every row needs an id' };
  if (!force) {
    const dup = rows.find((r) => existsSync(itemPath(home, module, r.id)));
    if (dup) return { ok: false, error: `note '${module}:${dup.id}' already exists (--force replaces)` };
  }
  const batch = rows.map(({ id, ...change }) => ({ module, id: `create-${id}`, op: 'create', target: id, change: withDefaults(home, module, change) }));
  const res = commit(home, { actor }, batch, { label: `create ${rows.length} row(s) in ${module}` });
  if (!res.ok) return res;
  return { ok: true, created: res.results.map((r) => r.note), generations: res.generations };
}

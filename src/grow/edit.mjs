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

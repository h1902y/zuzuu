// src/grow/edit.mjs — scoped writes: patch one field · append to the body.
//
// what: small, legible edits to one existing note — set a single frontmatter key
//       (`patch`) or append a line to the body (`append`) — instead of rewriting
//       the whole envelope. A smaller diff is a more reviewable diff (ACI ergonomics).
// why:  full-note CRUD makes the reviewer read a whole new version to find a one-key
//       change. Scoped edits keep the intent legible. Human-initiated; each lands as
//       one generation (sugar over evolve's update — same merge + mint, no new path).
// how:  thin wrappers over evolve(update) on an existing note. Zero-dep, fail-soft.

import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../notes/note.mjs';
import { itemPath } from '../notes/store.mjs';
import { evolve } from './evolve.mjs';

// a CLI value is text; coerce JSON (numbers/booleans/lists) but keep a plain string
const coerce = (v) => { try { return JSON.parse(v); } catch { return v; } };

/** Set ONE frontmatter field on an existing note → one generation. */
export function patchNote(home, module, id, key, value, actor = 'operator') {
  if (!existsSync(itemPath(home, module, id))) return { ok: false, error: `no note '${module}:${id}'` };
  if (key === 'id' || key === 'type') return { ok: false, error: `'${key}' is structural — not patchable` };
  return evolve(home, module, { id: `patch-${id}`, op: 'update', target: id, change: { [key]: coerce(value) } }, actor);
}

/** Append text to an existing note's body → one generation. */
export function appendNote(home, module, id, text, actor = 'operator') {
  const path = itemPath(home, module, id);
  if (!existsSync(path)) return { ok: false, error: `no note '${module}:${id}'` };
  const cur = parse(readFileSync(path, 'utf8'), { id }).note ?? {};
  const body = [cur.body, text].filter((s) => s && s.trim()).join('\n');
  return evolve(home, module, { id: `append-${id}`, op: 'update', target: id, change: { body } }, actor);
}

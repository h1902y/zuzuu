// src/grow/schema.mjs — ALTER TABLE for a module's typed-column schema.
//
// what: the operator-gated manifest mutations that grow/shrink a module's `fields`
//       block — `addColumn` · `alterColumn` · `dropColumn`. Each rewrites `module.md`'s
//       schema and mints a generation, so the change is versioned + rollback-able.
// why:  the schema is the module's contract (a TABLE's columns); changing it is a real,
//       gated mutation. It does NOT route through `commit()` — that boundary is for the
//       module's ITEMS (rows). A manifest write is OPERATOR-initiated (a person typing
//       `zz module add-column`), which IS the gate, the way `zz init` and a rollback are.
// how:  read the manifest envelope (round-trip every key via the note parser), mutate the
//       `fields` array, write it back, then `mint` — `commitGeneration` already scopes the
//       commit to `.zuzuu/<module>`, which includes `module.md`, so the manifest change
//       lands in the generation. Pure validation up front; fail-soft, structured errors.

import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse, serialize } from '../notes/note.mjs';
import { manifestPath } from '../notes/store.mjs';
import { mint } from '../notes/generation.mjs';
import { writeText, mkdirp } from '../metal/fs.mjs';

// The 8 FieldTypes a column may declare (mirrors web's field-registry + validate.mjs).
const FIELD_TYPES = new Set(['text', 'longtext', 'select', 'multi', 'link', 'date', 'number', 'bool']);

// Read the manifest as a raw envelope (every key preserved) + its current `fields`.
function readSchema(home, module) {
  const path = manifestPath(home, module);
  if (!existsSync(path)) return { ok: false, error: `no module '${module}' (its module.md is absent)` };
  const { note } = parse(readFileSync(path, 'utf8'), { id: module });
  if (!note) return { ok: false, error: `unparseable module.md for '${module}'` };
  return { ok: true, path, note, fields: Array.isArray(note.fields) ? note.fields : [] };
}

// Write the manifest back with new `fields` + mint a generation (forward motion). An
// EMPTY fields array drops the key entirely (back to schemaless), so the round-trip is clean.
function writeSchema(home, module, path, note, fields, label) {
  const next = { ...note, fields };
  if (!fields.length) delete next.fields;
  mkdirp(dirname(path));
  writeText(path, serialize(next));
  const g = mint(home, module, { label });
  return { ok: true, module, fields, generation: g.n };
}

// Build a clean FieldDef from CLI inputs — only the keys that carry meaning.
function fieldDef(name, type, { required = false, options = null } = {}) {
  const f = { name, type };
  if (required) f.required = true;
  if (Array.isArray(options) && options.length) f.options = options;
  return f;
}

/** Add a typed column to a module's schema. Errors if the module/manifest is absent, the
 *  type is unknown, or the column already exists. @returns {{ok, fields?, generation?, error?}} */
export function addColumn(home, module, name, type, opts = {}) {
  if (!name) return { ok: false, error: 'a column needs a name' };
  if (!FIELD_TYPES.has(type)) return { ok: false, error: `unknown type '${type}' — one of ${[...FIELD_TYPES].join('|')}` };
  const s = readSchema(home, module);
  if (!s.ok) return s;
  if (s.fields.some((f) => f.name === name)) return { ok: false, error: `column '${name}' already exists` };
  return writeSchema(home, module, s.path, s.note, [...s.fields, fieldDef(name, type, opts)], `add-column ${module}.${name}`);
}

/** Alter an existing column (type and/or required and/or options). Errors if the column
 *  is absent or a supplied type is unknown. @returns {{ok, fields?, generation?, error?}} */
export function alterColumn(home, module, name, opts = {}) {
  const s = readSchema(home, module);
  if (!s.ok) return s;
  const idx = s.fields.findIndex((f) => f.name === name);
  if (idx === -1) return { ok: false, error: `no column '${name}' in ${module}` };
  const cur = s.fields[idx];
  const type = opts.type ?? cur.type;
  if (opts.type && !FIELD_TYPES.has(opts.type)) return { ok: false, error: `unknown type '${opts.type}' — one of ${[...FIELD_TYPES].join('|')}` };
  const required = opts.required !== undefined ? opts.required : cur.required;
  const options = opts.options !== undefined ? opts.options : cur.options;
  const next = [...s.fields];
  next[idx] = fieldDef(name, type, { required, options });
  return writeSchema(home, module, s.path, s.note, next, `alter-column ${module}.${name}`);
}

/** Drop a column from a module's schema. Errors if the column is absent.
 *  @returns {{ok, fields?, generation?, error?}} */
export function dropColumn(home, module, name) {
  const s = readSchema(home, module);
  if (!s.ok) return s;
  if (!s.fields.some((f) => f.name === name)) return { ok: false, error: `no column '${name}' in ${module}` };
  return writeSchema(home, module, s.path, s.note, s.fields.filter((f) => f.name !== name), `drop-column ${module}.${name}`);
}

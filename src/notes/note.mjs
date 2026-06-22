// src/notes/note.mjs — the atom: one note (markdown + frontmatter).
//
// what: parse / serialize / validate one markdown file with YAML frontmatter
//       (a "note"), and resolve its id from the filename. The single file format
//       the whole system reads — a note, a module manifest, all of it (the
//       "everything is an envelope" rule; a note is the runnable kind).
// why:  one parser, one format. Distinguished by `type` (OKF: only `type` is
//       required, and unknown keys are always tolerated and preserved, so the
//       brain learns new vocabulary without migrations).
// how:  hand-rolled, zero-dep (no YAML lib). The frontmatter we emit is the
//       JSON-compatible subset of YAML — scalars + block lists/one-level maps,
//       with inline JSON for deeper nesting — so a real YAML parser can read
//       our files and we can read them with no dependency. Never throws.

import { basename, extname } from 'node:path';

// ── scalar quoting — round-trips exact, incl. backslashes (guardrail regexes) ──
// (harvested verbatim from module/envelope.mjs:105-118)

const unquote = (s) => {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    try { return JSON.parse(t); } catch { return t.slice(1, -1); }
  }
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1);
  return t;
};

const SCALARISH = /^(-?\d+(\.\d+)?|true|false|null)$/; // a string that would re-parse as a non-string
const quoteScalar = (s) => {
  if (typeof s === 'number' || typeof s === 'boolean' || s === null) return String(s); // emit numbers/booleans/null bare so they round-trip as types
  const t = String(s);
  // a multiline value JSON-escapes onto one line (so `parse` and `serialize` are
  // symmetric — a note that parsed can always re-serialize, never throws)
  if (t.includes('\n')) return JSON.stringify(t);
  if (SCALARISH.test(t)) return JSON.stringify(t); // quote a string that LOOKS scalar, so it stays a string
  return /[:#'"\\[\]{}]|^-\s|^[\s]|[\s]$|^$/.test(t) ? JSON.stringify(t) : t;
};

const KV = /^([A-Za-z_][\w-]*):\s*(.*)$/;
const SPLIT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// A frontmatter value is a scalar, an array, or a plain object. We coerce a raw
// frontmatter token: inline JSON (`[…]` / `{…}` / quoted) is JSON-parsed;
// everything else is an unquoted scalar (string).
const isScalar = (v) => v == null || typeof v !== 'object';
const looksInlineJson = (t) => /^[[{]/.test(t.trim());

const parseValueToken = (raw) => {
  const t = raw.trim();
  if (looksInlineJson(t)) {
    try { return JSON.parse(t); } catch { /* fall through to scalar */ }
  }
  // bare (unquoted) booleans / null / numbers coerce to their type — a quoted
  // form ("5", "true") stays a string via unquote, so types round-trip exactly.
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return unquote(t);
};

// ── parse ─────────────────────────────────────────────────────────────────

/**
 * Parse a note file's text into `{ type, body, ...frontmatter }`. Never throws.
 * Every key is preserved (known + unknown). `id` is the caller's (filename),
 * not read from frontmatter.
 * @param {string} text
 * @param {{id?: string}} [opts]
 * @returns {{ok: boolean, note: object|null, errors: string[]}}
 */
export function parse(text, { id } = {}) {
  const errors = [];
  const m = SPLIT.exec(String(text));
  if (!m) return { ok: false, note: null, errors: ['no frontmatter block'] };
  const [, fm, body] = m;
  const note = { body: body.trim() };
  if (id != null) note.id = id;

  let key = null;       // current top-level key awaiting a block
  let mode = null;      // 'list' | 'map' once the first child resolves it
  let entry = null;     // current list entry (a flat map) being filled

  for (const rawLine of fm.split('\n')) {
    if (!rawLine.trim()) continue;
    const indent = rawLine.match(/^ */)[0].length;
    const line = rawLine.trim();

    if (indent === 0) {
      key = null; mode = null; entry = null;
      const kv = KV.exec(line);
      if (!kv) { errors.push(`bad line: ${line}`); continue; }
      const [, k, val] = kv;
      if (val === '') { key = k; note[k] = undefined; }   // opens a block
      else { note[k] = parseValueToken(val); }
      continue;
    }

    if (!key) { errors.push(`unexpected indented line: ${line}`); continue; }

    if (line.startsWith('- ')) {
      // a list entry
      if (mode === 'map') { errors.push(`${key}: mixed map/list`); continue; }
      if (mode !== 'list') { mode = 'list'; note[key] = []; }
      const rest = line.slice(2);
      const kv = KV.exec(rest);
      if (kv && kv[2] !== '') { entry = { [kv[1]]: parseValueToken(kv[2]) }; note[key].push(entry); }
      else { entry = null; note[key].push(parseValueToken(rest)); }
    } else if (mode === 'list' && entry && indent >= 4) {
      // continuation of the current flat-map list entry
      const kv = KV.exec(line);
      if (!kv) { errors.push(`bad ${key} entry line: ${line}`); continue; }
      entry[kv[1]] = parseValueToken(kv[2]);
    } else {
      // a one-level map entry
      if (mode === 'list') { errors.push(`${key}: mixed list/map`); continue; }
      if (mode !== 'map') { mode = 'map'; note[key] = {}; }
      const kv = KV.exec(line);
      if (!kv) { errors.push(`bad ${key} line: ${line}`); continue; }
      note[key][kv[1]] = parseValueToken(kv[2]);
    }
  }

  // a key that opened a block but got no children resolves to {}
  for (const k of Object.keys(note)) if (note[k] === undefined) note[k] = {};

  if (!note.type) errors.push('missing required field: type');
  return { ok: errors.length === 0, note, errors };
}

// ── serialize ─────────────────────────────────────────────────────────────

/** Serialize a note note → file text that `parse` round-trips. `id` is omitted
 *  (it lives in the filename, not the frontmatter). */
export function serialize(note) {
  const { id: _omit, body, ...fm } = note ?? {};
  const lines = ['---'];
  for (const [key, val] of Object.entries(fm)) {
    if (val === undefined) continue;
    if (isScalar(val)) {
      lines.push(`${key}: ${quoteScalar(val)}`);
    } else if (Array.isArray(val)) {
      if (val.length === 0) lines.push(`${key}: []`); // inline JSON, so an empty array round-trips as []
      else if (val.every(isScalar)) { lines.push(`${key}:`); for (const v of val) lines.push(`  - ${quoteScalar(v)}`); }
      else lines.push(`${key}: ${JSON.stringify(val)}`);
    } else {
      // plain object: block one-level map if all values are scalars, else inline JSON
      const entries = Object.entries(val);
      if (entries.length === 0) lines.push(`${key}: {}`); // empty object round-trips as {}
      else if (entries.every(([, v]) => isScalar(v))) { lines.push(`${key}:`); for (const [k, v] of entries) lines.push(`  ${k}: ${quoteScalar(v)}`); }
      else lines.push(`${key}: ${JSON.stringify(val)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n') + (body ? String(body).trim() + '\n' : '');
}

// ── validate ──────────────────────────────────────────────────────────────

// ── id + title helpers ──────────────────────────────────────────────────────

/** id = the filename stem. `…/client-acme-style.md` → `client-acme-style`. */
export function idFromPath(filepath) {
  return basename(String(filepath), extname(String(filepath)));
}

/** A safe id slug: lowercase, non-alphanumerics → `-`. (harvested from knowledge/items.mjs) */
export function slugify(text, max = 60) {
  const s = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
  return s || 'note';
}

/** Title fallback = first non-empty body line, de-markdowned, capped. */
export function deriveTitle(body, id = '') {
  for (const raw of String(body ?? '').split('\n')) {
    const t = raw.replace(/^#+\s*/, '').replace(/[*_`>]/g, '').trim();
    if (t) return t.slice(0, 80);
  }
  return id;
}

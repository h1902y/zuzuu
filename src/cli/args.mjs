// src/cli/args.mjs — the handler substrate every verb file shares.
//
// what: the argv-shaping and output-emitting helpers the command handlers compose:
//       flag coercions (`str`/`list`), repeated-flag scanners (`whereFilters`,
//       `fieldPairs`), the `--where` operator grammar (`parseWhere`), sort parsing,
//       the grid row projection (`projectRow`/`columnsFor`), and the two emitters
//       (`fail`/`emit`) that keep the single-stdout-document invariant.
// why:  these patterns used to repeat inline across a 1200-line commands.mjs —
//       three hand-rolled comma-splits, two --field scanners, one drifting copy
//       away from a bug. One definition each; the verb files stay about verbs.
// how:  pure functions over parsed args/raw argv. parseArgs keeps only the LAST
//       of a repeated flag, so anything repeatable scans the raw `rest` instead.
//       Zero-dep.

import { toon } from '../notes/toon.mjs';
import { WHERE_OPS } from '../notes/validate.mjs';

/** A flag value as a string — '' when absent or bare (`--title` with no value). */
export const str = (v) => (v && v !== true ? String(v) : '');

/** A comma-list flag → trimmed non-empty parts — [] when absent or bare. */
export const list = (v) => (v && v !== true ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);

/** A boolean flag value: bare `--x` (parseArgs already made it `true`) OR an
 *  EXPLICIT `--x true|false` string (the daemon always sends one — it needs to be
 *  able to turn a flag OFF, which a bare `!!v` truthiness check can never express:
 *  `!!'false'` is true). Anything else (absent/other) is false. */
export const flag = (v) => v === true || v === 'true' || v === '1';

/** Repeated `--where key<op>val` → [{key,value,op}] (the EAV column filters;
 *  op ∈ WHERE_OPS, the canonical list — notes/validate.mjs, audit
 *  2026-07-03-triggers-review.md NIT 1). A pair without an operator (or empty key) is
 *  skipped. */
export function parseWhere(pair) {
  for (const op of WHERE_OPS) { // longest first
    const at = pair.indexOf(op);
    if (at > 0) return { key: pair.slice(0, at), op, value: pair.slice(at + op.length) };
  }
  return null;
}
export function whereFilters(rest) {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--where' && rest[i + 1] != null) {
      const f = parseWhere(rest[i + 1]);
      if (f) out.push(f);
      i++;
    }
  }
  return out;
}

/** Repeated `--field k=v` → a change object. `coerce(key, value)` maps each value
 *  (identity by default; `note create` passes the schema-aware coercion). `flagName`
 *  overrides the scanned flag (default `--field`) — `zz run start`'s `--input k=v`
 *  reuses this SAME repeated-pair grammar rather than a second hand-rolled scanner. */
export function fieldPairs(rest, coerce = (_k, v) => v, flagName = '--field') {
  const out = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === flagName && rest[i + 1] != null) {
      const eq = rest[i + 1].indexOf('=');
      if (eq > 0) {
        const k = rest[i + 1].slice(0, eq);
        out[k] = coerce(k, rest[i + 1].slice(eq + 1));
      }
      i++;
    }
  }
  return out;
}

/** `--sort <col>[:desc]` → { col, desc } | null (the index orders by it). */
export function parseSort(raw) {
  if (!raw || raw === true) return null;
  const [col, dir] = String(raw).split(':');
  return col ? { col, desc: dir === 'desc' } : null;
}

// The read projection's column SKIP set — mirrors the client grid's `inferKeys`
// (web/src/client/shell/stage/grid-columns.ts): `module` is implicit, `body` is the
// record, `provenance`/`payload` are nested objects. They still ride in the item
// (the record needs them); they're just not displayed AS columns.
const COLUMN_SKIP = new Set(['module', 'body', 'provenance', 'payload']);

/** Map a hydrated envelope to the daemon's ModuleItem shape: `type` → `kind`, the
 *  `module` injected, every other frontmatter column (incl. custom ones + `source`)
 *  carried through whole. The lossless row the grid renders. */
export function projectRow(note, module) {
  const { type, ...rest } = note; // rest: id · title · status · body · custom columns…
  return { id: rest.id, module, kind: type ?? '', title: rest.title ?? '', status: rest.status ?? '', ...rest };
}

/** The displayable column set across a set of items: the union of their keys minus
 *  the SKIP internals (matches the client's `inferKeys`), so a custom frontmatter
 *  column surfaces as a column. Insertion order preserved; null/absent values skip. */
export function columnsFor(items) {
  const cols = [];
  const seen = new Set();
  for (const it of items) for (const k of Object.keys(it)) {
    if (!COLUMN_SKIP.has(k) && !seen.has(k) && it[k] != null) { seen.add(k); cols.push(k); }
  }
  return cols;
}

/** Structured one-line error → exit 1. JSON under --json (the daemon JSON.parses it). */
export function fail(log, msg, json = false) {
  log(json ? JSON.stringify({ ok: false, error: msg }) : toon('error', [{ message: msg }], ['message']));
  return 1;
}

/** Emit a value as JSON (--json, for the daemon) or as TOON. `toonArgs` = [name, rows, cols, hints?]. */
export function emit(log, json, value, toonArgs) {
  log(json ? JSON.stringify(value) : toon(...toonArgs));
}

// src/notes/validate.mjs — the pre-write schema check (the linter-before-edit).
//
// what: validate a note envelope before it is written, on TWO axes: (1) the minimal
//       invariants its `type` implies (a rule needs action+pattern, an action needs
//       run) and (2) — when its module declares a typed-column schema — that each note
//       COMPLIES with that schema (required columns present, present values coercible
//       to their declared type). Returns structured errors the caller can surface.
// why:  SWE-agent's lesson: validate before the side effect, return an actionable
//       error — don't let a malformed note land and only fail later at use time. The
//       schema axis lights up the dormant `fields` apparatus: "a module is a TABLE, a
//       note a ROW, the columns are the schema" — items must comply where it's declared.
// how:  pure, data-keyed checks. TOLERANT by design: the per-type axis only guards the
//       load-bearing fields; the schema axis validates the DECLARED columns and is silent
//       about everything else (unknown frontmatter keys round-trip untouched — the OKF
//       invariant holds). A module with NO `fields` is schemaless: behaves exactly as the
//       per-type axis alone. Zero-dep.

const RULE_ACTIONS = new Set(['deny', 'ask', 'allow']);
const nonEmptyStr = (v) => typeof v === 'string' && v.trim() !== '';

// A value counts as ABSENT (nothing to coerce; fails `required`) when it's nullish, a
// blank string, or an empty array. Numbers and booleans are never empty — `0`/`false`
// are real values a required column is satisfied by.
const isEmpty = (v) => v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
const isScalar = (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
const inOptions = (f, x) => !Array.isArray(f.options) || !f.options.length || f.options.includes(x);

// The FieldType coercion table — given a PRESENT, non-empty value, is it coercible to the
// declared column type? One legible row per FieldType (the 8 the field-registry mirrors):
//   text/longtext a scalar · select ∈ options · multi an array ⊆ options · link an id
//   string · date parses · number parses · bool is boolean-ish. Unknown type ⇒ accept.
const COERCIBLE = {
  text: (v) => isScalar(v),
  longtext: (v) => isScalar(v),
  select: (v, f) => inOptions(f, v),
  multi: (v, f) => Array.isArray(v) && v.every((x) => typeof x === 'string' && inOptions(f, x)),
  link: (v) => typeof v === 'string',
  date: (v) => v instanceof Date || (typeof v === 'string' && !Number.isNaN(Date.parse(v))),
  number: (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))),
  bool: (v) => typeof v === 'boolean' || ['true', 'false', 'yes', 'no', '0', '1'].includes(String(v).toLowerCase()),
};

// the message for a value that doesn't fit its column — name the constraint that failed.
function coerceError(f) {
  if (f.type === 'select' || f.type === 'multi') {
    const opts = Array.isArray(f.options) ? f.options.join(', ') : '';
    return `field '${f.name}' must be ${f.type === 'multi' ? 'a subset of' : 'one of'}: ${opts}`;
  }
  return `field '${f.name}' must be a ${f.type}`;
}

/**
 * Validate a note. The optional `fields` is the module's declared typed-column schema
 * (a `FieldDef[]` from its `module.md`); `[]`/absent ⇒ schemaless (the per-type axis only).
 * @param {object} note
 * @param {Array<{name:string,type:string,required?:boolean,options?:string[]}>} [fields]
 * @returns {{ ok:boolean, errors:string[] }}
 */
export function validateNote(note, fields = []) {
  if (!note || typeof note !== 'object') return { ok: false, errors: ['not an envelope'] };
  const errors = [];
  if (!nonEmptyStr(note.type)) errors.push('missing required field: type');

  // ── axis 1: per-type invariants (the load-bearing fields a standard type needs) ──
  if (note.type === 'rule') {
    if (!RULE_ACTIONS.has(note.action)) errors.push(`a rule needs action ∈ deny|ask|allow (got ${JSON.stringify(note.action ?? null)})`);
    if (!nonEmptyStr(note.pattern)) errors.push('a rule needs a non-empty pattern');
  }
  if (note.type === 'action' && !nonEmptyStr(note.run)) errors.push('an action needs a run command');
  if (note.type === 'workflow') {
    if (!Array.isArray(note.steps) || !note.steps.length) errors.push('a workflow needs a non-empty steps list');
    else if (note.steps.some((s) => !s || !nonEmptyStr(s.id) || !nonEmptyStr(s.run))) errors.push('every workflow step needs an id and a run');
  }

  // ── axis 2: the module's typed-column schema (only when it declares one) ──
  // The note must COMPLY with the declared columns: required ones present + non-empty,
  // present ones coercible to their type. Extra (undeclared) columns are untouched —
  // schema validates the table's columns, it doesn't forbid others.
  for (const f of Array.isArray(fields) ? fields : []) {
    if (!f || !nonEmptyStr(f.name)) continue;
    const present = !isEmpty(note[f.name]);
    if (f.required && !present) { errors.push(`field '${f.name}' is required`); continue; }
    if (!present) continue; // optional + absent/blank → nothing to coerce
    const coercible = COERCIBLE[f.type];
    if (coercible && !coercible(note[f.name], f)) errors.push(coerceError(f));
  }

  return { ok: errors.length === 0, errors };
}

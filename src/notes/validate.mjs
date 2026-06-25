// src/notes/validate.mjs — the pre-write schema check (the linter-before-edit).
//
// what: validate a note envelope against the minimal invariants its `type` implies,
//       BEFORE it is written. Returns structured errors the caller can surface.
// why:  SWE-agent's lesson: validate before the side effect, return an actionable
//       error — don't let a malformed note (a rule with no pattern, an action with
//       no run) land and only fail later at use time.
// how:  pure, type-keyed checks. Lenient by design — only the load-bearing fields
//       per standard type; unknown types just need `type`. Zero-dep.

const RULE_ACTIONS = new Set(['deny', 'ask', 'allow']);
const nonEmptyStr = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Validate a note. @returns {{ ok:boolean, errors:string[] }}
 */
export function validateNote(note) {
  if (!note || typeof note !== 'object') return { ok: false, errors: ['not an envelope'] };
  const errors = [];
  if (!nonEmptyStr(note.type)) errors.push('missing required field: type');
  if (note.type === 'rule') {
    if (!RULE_ACTIONS.has(note.action)) errors.push(`a rule needs action ∈ deny|ask|allow (got ${JSON.stringify(note.action ?? null)})`);
    if (!nonEmptyStr(note.pattern)) errors.push('a rule needs a non-empty pattern');
  }
  if (note.type === 'action' && !nonEmptyStr(note.run)) errors.push('an action needs a run command');
  if (note.type === 'workflow') {
    if (!Array.isArray(note.steps) || !note.steps.length) errors.push('a workflow needs a non-empty steps list');
    else if (note.steps.some((s) => !s || !nonEmptyStr(s.id) || !nonEmptyStr(s.run))) errors.push('every workflow step needs an id and a run');
  }
  return { ok: errors.length === 0, errors };
}

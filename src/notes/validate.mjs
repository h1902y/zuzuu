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

// ── binding (§I.1 / §I.6 MCP-native model, docs/specs/2026-07-02-polish-showcase-
// experience.md) — HOW a tool note (`type: action`) runs. "No new entity": a tool IS
// an action note; a toolkit IS the module it lives in (see notes/module.mjs's
// `readManifest` — its `fields` double as the tool's `inputSchema`). Absent `binding`
// = 'shell' = today's `run:` — full back-compat, an existing action note is unchanged.
// Exported so `use/act.mjs` (the shell/agent/mcp dispatch), `use/workflow.mjs` (a
// `note:` composition step must dispatch the SAME way, never bypass it), and
// `cli/verbs/tool.mjs` (the read-only toolkit/tool VIEW) all read the ONE closed set
// + the ONE prompt-resolution rule — notes/ stays the schema source of truth
// (zero-dep, importable downward by use/ and cli/, per this file's own header).
export const ACTION_BINDINGS = new Set(['shell', 'agent', 'mcp']);

/** A note's EFFECTIVE binding — absent/unrecognized → 'shell' (fail-soft: a garbage
 *  `binding:` value on a hand-edited note falls through to the well-tested shell path
 *  rather than silently no-opping; `validateNote` below is where a bad value is an
 *  actual, surfaced error at the write door). */
export function bindingOf(note) {
  const b = note?.binding;
  return typeof b === 'string' && ACTION_BINDINGS.has(b) ? b : 'shell';
}

/** The effective PROMPT for an `agent`-binding tool. DECISION (documented in
 *  docs/guide/Tools.md): an explicit `prompt:` wins; absent, `run:` is reused
 *  VERBATIM as the prompt string — one primary instruction field per action note
 *  regardless of binding, rather than forcing a second required key for a binding
 *  that's structurally "one string, delegated to the host". Null when neither is
 *  a non-empty string. */
export function promptOf(note) {
  if (nonEmptyStr(note?.prompt)) return note.prompt;
  if (nonEmptyStr(note?.run)) return note.run;
  return null;
}

// ── trigger (§I rung 4) — `on.kind` + the note-change filter grammar ──────────────
// Exported so `grow/trigger.mjs` (the fire/blast-radius engine) reuses the SAME closed
// kind set rather than re-declaring it — notes/ stays the schema source of truth,
// grow/ imports DOWN from it (never the reverse: notes/ stays dependency-free, so this
// file never imports grow/trigger.mjs back).
export const TRIGGER_ON_KINDS = new Set(['manual', 'note-change', 'cron', 'ingress']);
const TRIGGER_EVENTS = new Set(['create', 'update']);

// The EAV `--where` comparison operators — the ONE canonical list (audit
// 2026-07-03-triggers-review.md NIT 1). Before this, the same 6 ops were hand-mirrored
// in FIVE places (this file twice, `cli/args.mjs`'s `parseWhere`, `notes/index.mjs`'s
// `EAV_OPS`, `grow/trigger.mjs`'s `CLAUSE_OPS`) with nothing pinning them equal — add an
// op to one copy and forget another, and the blast-radius preview grammar silently
// diverges from the real query grammar (or vice versa). notes/ is the schema source of
// truth (zero-dep, importable downward by both grow/ and cli/ — see TRIGGER_ON_KINDS
// above), so this is where it lives; `index.mjs`, `args.mjs`, and `trigger.mjs` all
// import THIS array instead of re-declaring it. Longest-first — `>=`/`<=`/`!=` must be
// tried before their one-char prefix (`>`/`<`/`=`) or a two-char operator would never
// match past its own prefix.
export const WHERE_OPS = ['>=', '<=', '!=', '=', '>', '<'];
const TRIGGER_WHERE_OPS = new Set(WHERE_OPS);

// `run: 'module:id'` — a LOCAL module:id shape check (mirrors use/workflow.mjs's
// `splitAddr` exactly, independently pinned — see the workflow block below for why
// notes/ never imports use/ or grow/: it must stay acyclic).
const isModuleIdAddr = (v) => {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  const i = s.indexOf(':');
  return i > 0 && i < s.length - 1;
};

// A note-change `on.where` clause is well-formed as either a string `'key<op>value'`
// (the SAME grammar `zz query --where` parses — cli/args.mjs's `parseWhere`, now the
// SAME WHERE_OPS constant, not an independent mirror — see above) or an object
// `{key, op?, value}`.
function wellFormedWhereClause(c) {
  if (typeof c === 'string') {
    // NIT 2 (audit 2026-07-03-triggers-review.md): the operator must leave a
    // non-empty VALUE — `at > 0` alone let `'tier>='` (a value-less typo, almost
    // certainly a forgotten right-hand side, not an intentional empty-string match)
    // through as `{op:'>=', value:''}`. A structured clause `{key,op,value:''}` is a
    // DIFFERENT, deliberately unrestricted case (an explicit empty-string value is a
    // legitimate thing to match) and is untouched here.
    //
    // Mirrors parseClauseString/parseWhere's own control flow EXACTLY — a `for` loop
    // that returns on the FIRST op (in WHERE_OPS' longest-first order) whose text
    // appears — rather than testing every op independently (`.some`). That distinction
    // matters here: independently testing each op lets a two-char operator's own
    // one-char PREFIX (`>=`'s `>`, `<=`'s `<`) "rescue" an empty-value match — for
    // `'tier>='`, `>=` correctly fails the length check, but `.some` would go on to
    // test `>` alone, find it at the SAME position, and treat the leftover `=` as a
    // (non-empty!) value — right back to accepting the malformed clause. Stopping at
    // the first match (the same op the real parser would pick) avoids that entirely.
    for (const op of WHERE_OPS) {
      const at = c.indexOf(op);
      if (at > 0) return at + op.length < c.length;
    }
    return false;
  }
  if (c && typeof c === 'object' && !Array.isArray(c)) {
    return nonEmptyStr(c.key) && c.value !== undefined && (c.op == null || TRIGGER_WHERE_OPS.has(c.op));
  }
  return false;
}

// A permissive 5-field cron SHAPE check — validates syntax, not semantics (a full cron
// engine is HOSTED-tier's job; local `trigger fire` always ignores `expr` — see
// grow/trigger.mjs's header). Each field: `*` · a number · a range (`1-5`) · a step
// (`*/15`) · a comma list of any of those.
const CRON_FIELD_RE = /^(\*|\d+)(-\d+)?(\/\d+)?(,(\*|\d+)(-\d+)?(\/\d+)?)*$/;
export function isParseableCronExpr(expr) {
  if (typeof expr !== 'string') return false;
  const fields = expr.trim().split(/\s+/);
  return fields.length === 5 && fields.every((f) => CRON_FIELD_RE.test(f));
}

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
  // THE ENVELOPE FLOOR (02-07-2026): title/status must be non-empty. The write
  // boundary FILLS them before this check ever runs (repo.writeNote → fillFloor),
  // so a boundary write can't fail here — but `zz validate` on disk now SURFACES
  // legacy notes that predate the floor instead of hiding them (`zz module
  // backfill` heals them). Read tolerance unchanged: this is validation, not parse.
  if (!nonEmptyStr(note.title)) errors.push("the envelope floor: 'title' must be non-empty");
  if (!nonEmptyStr(note.status)) errors.push("the envelope floor: 'status' must be non-empty");

  // ── axis 1: per-type invariants (the load-bearing fields a standard type needs) ──
  if (note.type === 'rule') {
    if (!RULE_ACTIONS.has(note.action)) errors.push(`a rule needs action ∈ deny|ask|allow (got ${JSON.stringify(note.action ?? null)})`);
    if (!nonEmptyStr(note.pattern)) errors.push('a rule needs a non-empty pattern');
  }
  // a tool note's binding-appropriate invariant (§I.1/§I.6): shell needs `run:`
  // (unchanged — the ONLY case that fired before `binding` existed); agent needs a
  // resolvable prompt (`prompt:`, or `run:` reused as one — see promptOf above); mcp
  // needs a full `{server, tool}` target. An explicit-but-invalid `binding:` value is
  // its OWN error (never silently treated as shell) — that tolerance lives only in
  // the runtime dispatch helper `bindingOf`, not at the write door.
  if (note.type === 'action') {
    if (note.binding != null && !ACTION_BINDINGS.has(note.binding)) {
      errors.push(`an action's binding must be one of shell|agent|mcp (got ${JSON.stringify(note.binding)})`);
    } else {
      const binding = bindingOf(note);
      if (binding === 'shell' && !nonEmptyStr(note.run)) errors.push('an action needs a run command');
      else if (binding === 'agent' && !promptOf(note)) errors.push("an agent-binding action needs a prompt (a 'prompt' field, or 'run' reused as the prompt string)");
      else if (binding === 'mcp') {
        const mcp = note.mcp;
        const ok = mcp && typeof mcp === 'object' && !Array.isArray(mcp) && nonEmptyStr(mcp.server) && nonEmptyStr(mcp.tool);
        if (!ok) errors.push('an mcp-binding action needs mcp: {server, tool} (both non-empty)');
      }
    }
  }
  // secrets: DECLARED metadata only (§I.1.3/§J.3 — names never values; RESOLUTION into
  // a run's env is a follow-on build, not this one) — a tool may name which secret
  // NAMES it will need. Type-agnostic (like `relations`, below) — harmless on a
  // non-action note, meaningful once a tool references it.
  if (note.secrets != null) {
    const ok = Array.isArray(note.secrets) && note.secrets.every((s) => typeof s === 'string' && s.trim() !== '');
    if (!ok) errors.push("secrets must be a list of secret name strings (e.g. ['CLEARBIT_KEY'])");
  }
  // relations: a map rtype → entry|entries; an OBJECT entry must carry a target
  if (note.relations != null) {
    if (typeof note.relations !== 'object' || Array.isArray(note.relations)) {
      errors.push('relations must be a map of type → target(s)');
    } else {
      for (const [rt, v] of Object.entries(note.relations)) {
        for (const e of [].concat(v)) {
          if (e && typeof e === 'object' && !Array.isArray(e) && !nonEmptyStr(e.target)) {
            errors.push(`relation '${rt}' has an object entry without a target`);
          }
        }
      }
    }
  }
  if (note.type === 'workflow') {
    if (!Array.isArray(note.steps) || !note.steps.length) errors.push('a workflow needs a non-empty steps list');
    // a step is an id + EXACTLY ONE of run (inline shell) · note (a module:id
    // composition ref, §I rung 1) · wait (a {on,timeout?} pause, the Tier-2 durable
    // runner's kind, grow/run.mjs). Kept local/dependency-free (no import from use/
    // or grow/, preserving notes/'s acyclic position) rather than importing either
    // layer's own step-shape check — the SAME three-way rule, independently pinned.
    else if (note.steps.some((s) => {
      if (!s || !nonEmptyStr(s.id)) return true;
      const hasRun = nonEmptyStr(s.run);
      const hasNote = nonEmptyStr(s.note);
      const hasWait = s.wait != null && typeof s.wait === 'object' && !Array.isArray(s.wait) && nonEmptyStr(s.wait.on);
      return [hasRun, hasNote, hasWait].filter(Boolean).length !== 1;
    })) errors.push('every workflow step needs an id and exactly one of run, note, or wait');
    // N1 (audit 2026-07-03-durable-runner-review.md): a garbage `wait.timeout` used to
    // land here and only surface later at `zz run start` (grow/run.mjs's own
    // stepShapeError) — fail at the write door instead. A local regex (not an import
    // of run.mjs's DURATION_RE) keeps notes/ acyclic, per the comment above.
    else if (note.steps.some((s) => s.wait?.timeout != null && !/^\d+(?:\.\d+)?\s*(ms|s|m|h|d)?$/i.test(String(s.wait.timeout).trim()))) {
      errors.push('a workflow step wait.timeout must be a valid duration (e.g. 30s, 5m, 2h, 1d)');
    }
  }
  // trigger (§I rung 4): a gated, versioned way to NAME an automation — never new
  // execution authority. `on.kind` is the closed set above; `run` is the `module:id`
  // it fires (a workflow, through the durable runner — see grow/trigger.mjs); `enabled`
  // is the SECOND gate (§I.4 #7) — a trigger note can land through review but stay
  // off until a human flips it. Tolerant on `enabled`'s TYPE (a CLI `--field
  // enabled=true` staged via `zz stage` with no coercion lands as the STRING "true" —
  // reuse the same boolean-ish tolerance COERCIBLE.bool already gives typed columns).
  if (note.type === 'trigger') {
    const on = note.on;
    if (!on || typeof on !== 'object' || Array.isArray(on)) {
      errors.push('a trigger needs an on: {kind, …} object');
    } else if (!TRIGGER_ON_KINDS.has(on.kind)) {
      errors.push(`a trigger needs on.kind ∈ manual|note-change|cron|ingress (got ${JSON.stringify(on.kind ?? null)})`);
    } else if (on.kind === 'note-change') {
      if (!TRIGGER_EVENTS.has(on.event)) errors.push(`a note-change trigger needs on.event ∈ create|update (got ${JSON.stringify(on.event ?? null)})`);
      if (on.where != null) {
        if (!Array.isArray(on.where)) errors.push("a note-change trigger's on.where must be a list of clauses");
        else for (const c of on.where) if (!wellFormedWhereClause(c)) errors.push(`a note-change trigger's on.where has a malformed clause: ${JSON.stringify(c)}`);
      }
    } else if (on.kind === 'cron') {
      if (!isParseableCronExpr(on.expr)) errors.push(`a cron trigger needs a parseable on.expr (got ${JSON.stringify(on.expr ?? null)}) — HOSTED-ONLY: local zuzuu never auto-fires it (see zz doctor)`);
    }
    if (!isModuleIdAddr(note.run)) errors.push("a trigger needs a run target 'module:id'");
    if (note.enabled != null && !COERCIBLE.bool(note.enabled)) errors.push("trigger 'enabled' must be a boolean");
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

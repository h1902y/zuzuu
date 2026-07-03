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

// ── secrets (§J.3/§J.5, docs/specs/2026-07-02-polish-showcase-experience.md) — a
// `type: secret` note is a DECLARATION ONLY. The load-bearing invariant: the VALUE
// may never be written to a note — enforced HERE, at the write door, not left as a
// convention. Exported so `use/secrets.mjs` (the resolver) and `cli/verbs/secret.mjs`
// (the read-only view) read the SAME closed sets + the SAME scope-matching rule —
// notes/ stays the schema source of truth (zero-dep, importable downward), same
// pattern as ACTION_BINDINGS/bindingOf above.
export const SECRET_ACTORS = new Set(['operator-only', 'agent-allowed']);
export const SECRET_RESOLVES_FROM = new Set(['env', 'secrets-file', 'fly', 'oidc']);
// SUPERSEDED by SECRET_KEY_RE below (audit 2026-07-03-secrets-review.md S1) — kept
// exported (the exact literal set) only because it's still a legible "the headline
// forbidden names" reference for error text / tests; the actual write-door MATCH is
// now the substring shape, not this exact-key Set.
export const SECRET_FORBIDDEN_FIELDS = new Set(['value', 'secret', 'key', 'token', 'password', 'credential']);
// ONE canonical secret-key-SHAPE matcher (S1) — substring, not exact, shared verbatim
// by notes/log.mjs's runtime redaction (imported from here, not re-declared: the same
// DRY move as WHERE_OPS above) so the WRITE door (this file) and the LOG door mask/
// refuse the same shapes. `api_key`/`access_token`/`client_secret`/`apikey`/
// `privatekey` ride the already-present key/token/secret substrings; `bearer`/
// `passphrase`/`pat`/`pw` are the true additions the exact-match era missed entirely.
// `pat`/`pw` use a lookaround, not `\b` — `\b` treats `_` as a word character, so
// `\bpat\b` would NOT catch `GITHUB_PAT` or `db_pw` (no boundary between `_` and a
// letter) — the lookaround excludes only adjacent alphanumerics, which underscore
// isn't. `value` rides directly (not merely "looks secret-shaped" — it's this write
// door's literal headline forbidden field, `{type:secret, value:'sk-…'}`).
export const SECRET_KEY_RE = /(value|key|token|secret|password|passwd|credential|auth|bearer|passphrase|(?<![a-z0-9])pat(?![a-z0-9])|(?<![a-z0-9])pw(?![a-z0-9]))/i;
// fields whose nested keys are STRUCTURAL (relation TYPE names, not value-bearing
// data) — skipped by secretValueLeaks' one-level nested scan (S2) so a custom
// relation type name never false-positives a refusal. Today's canonical relation
// vocabulary (relates-to/informs/builds-on/…, see CLAUDE.md) doesn't collide with
// SECRET_KEY_RE, but a future free-form type name might.
const SECRET_SCAN_SKIP_NESTED = new Set(['relations']);
const ENV_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;
// A scope entry is `<left>:<right>` — interpreted at RESOLVE time (scopeMatches,
// below), not here: `module:<name>` / `tool:<name>` (a keyword-prefixed allowlist
// rule) OR a bare `module:tool` address (an exact-match rule). All three shapes are
// syntactically identical (`word:word`), so validation only checks the SHAPE.
const SCOPE_ENTRY_RE = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;
export const isScopeEntry = (v) => typeof v === 'string' && SCOPE_ENTRY_RE.test(v.trim());

/**
 * Does `caller` (a bare module id, or a `module:tool` address — e.g. `act()`'s own
 * `${module}:${id}`) match ONE entry in a secret declaration's `scope` allowlist?
 * Three entry shapes, first match wins: `module:<name>` (any caller IN that module),
 * `tool:<name>` (any caller whose tool/leaf id is `name`, module-agnostic), or a
 * literal `module:tool` address (exact match against the caller's full address).
 * An unlisted caller — including a missing/empty scope — matches NOTHING (fail-closed:
 * §J.3 "unlisted caller → resolution error, not a value").
 */
export function scopeMatches(scope, caller) {
  if (!Array.isArray(scope) || !caller) return false;
  const c = String(caller).trim();
  const ci = c.indexOf(':');
  const callerModule = ci === -1 ? c : c.slice(0, ci);
  const callerTool = ci === -1 ? null : c.slice(ci + 1);
  for (const raw of scope) {
    if (!isScopeEntry(raw)) continue;
    const entry = raw.trim();
    const i = entry.indexOf(':');
    const left = entry.slice(0, i);
    const right = entry.slice(i + 1);
    if (left === 'module' && right === callerModule) return true;
    if (left === 'tool' && (right === callerTool || right === c)) return true;
    if (entry === c) return true; // a bare 'module:tool' address, exact match
  }
  return false;
}

/**
 * S1/S2 (audit 2026-07-03-secrets-review.md) — scan a (possibly PARTIAL) note-shaped
 * object for a secret-VALUE leak: the write door's ONE job for `type: secret`.
 * (a) every top-level key — substring-shape match (S1, SECRET_KEY_RE — not the old
 *     exact-match SECRET_FORBIDDEN_FIELDS); (b) one level into any nested map (S2 —
 *     `meta: {token:…}`), skipping known-structural maps (SECRET_SCAN_SKIP_NESTED);
 *     (c) a non-empty `body` (S2 — a secret DECLARATION has no prose; an empty body
 *     is the correct, honest shape, never an omission to fill).
 * Pure; returns the offending field name(s) — dotted for a nested hit (`meta.token`),
 * literal `'body'` for prose — `[]` means clean. No `note.type` gate here: the CALLER
 * decides when this is worth running (`validateNote` below gates on
 * `note.type === 'secret'`; `grow/stage.mjs`'s pre-write check gates on the STAGED
 * change's PROJECTED type — see its own doc comment for why that's the SAME check,
 * not a re-implementation).
 */
export function secretValueLeaks(note) {
  if (!note || typeof note !== 'object') return [];
  const hits = [];
  for (const [k, v] of Object.entries(note)) {
    if (k === 'body') continue; // checked separately below (prose, not a key)
    if (SECRET_KEY_RE.test(k)) { hits.push(k); continue; }
    if (v && typeof v === 'object' && !Array.isArray(v) && !SECRET_SCAN_SKIP_NESTED.has(k)) {
      for (const nk of Object.keys(v)) if (SECRET_KEY_RE.test(nk)) hits.push(`${k}.${nk}`);
    }
  }
  if (nonEmptyStr(note.body)) hits.push('body');
  return hits;
}

/** A secret declaration's effective ACTOR gate — absent/unrecognized ⇒ 'operator-only'
 *  (fail-CLOSED default: an unlabeled secret never resolves for an agent). */
export function secretActorOf(note) {
  return SECRET_ACTORS.has(note?.actor) ? note.actor : 'operator-only';
}

/** A secret declaration's effective `resolves_from` — absent/unrecognized ⇒ 'env'
 *  (§J.5: the host already materializes the value into `process.env` before this
 *  process starts — fly-injected-at-boot, keychain/`op`-exported, or a plain `export`). */
export function secretResolvesFromOf(note) {
  return SECRET_RESOLVES_FROM.has(note?.resolves_from) ? note.resolves_from : 'env';
}

/** A secret declaration's effective `sensitive` — absent ⇒ `true` (Vercel's April-2026
 *  breach lesson: opt-in sensitivity fails; default-secure instead). Boolean-ish
 *  tolerant, like COERCIBLE.bool below (a staged `--field sensitive=false` lands
 *  as the string "false"). */
export function secretSensitiveOf(note) {
  const v = note?.sensitive;
  if (v === false) return false;
  if (typeof v === 'string' && ['false', 'no', '0'].includes(v.toLowerCase())) return false;
  return true;
}

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
  // ── type: secret (§J.3/§J.5) — a DECLARATION ONLY. THE enforcement: the value can
  // NEVER be written to a note — checked FIRST and unconditionally, before any other
  // secret-shaped invariant, so a forbidden field is caught even on an otherwise
  // malformed declaration. `secretValueLeaks` (S1/S2, audit 2026-07-03-secrets-
  // review.md) is a SUBSTRING-shape match (not exact) that also recurses one level
  // into nested maps and refuses a non-empty body — a legitimate declaration field
  // (name/scope/actor/resolves_from/rotation_note/sensitive/last_used) never collides
  // (verified: none of those names contain a SECRET_KEY_RE substring).
  if (note.type === 'secret') {
    const leaks = secretValueLeaks(note);
    if (leaks.length) {
      errors.push(`a secret declaration must never carry a value-bearing field (found: ${leaks.join(', ')}) — the value lives on the host, never in the note (see docs/guide/Secrets.md)`);
    }
    if (!nonEmptyStr(note.name) || !ENV_NAME_RE.test(note.name.trim())) {
      errors.push("a secret needs a non-empty env-var-shaped 'name' (e.g. OPENAI_API_KEY — uppercase letters/digits/underscore, not starting with a digit)");
    }
    // scope is OPTIONAL here (an absent/empty scope is fail-closed — resolveSecret
    // matches nothing — not a write-door error); PRESENT means well-formed.
    if (note.scope != null) {
      const ok = Array.isArray(note.scope) && note.scope.length > 0 && note.scope.every(isScopeEntry);
      if (!ok) errors.push("a secret's scope must be a non-empty list of 'module:x' / 'tool:x' / 'module:tool' strings");
    }
    if (note.actor != null && !SECRET_ACTORS.has(note.actor)) {
      errors.push(`a secret's actor must be one of operator-only|agent-allowed (got ${JSON.stringify(note.actor)})`);
    }
    if (note.resolves_from != null && !SECRET_RESOLVES_FROM.has(note.resolves_from)) {
      errors.push(`a secret's resolves_from must be one of env|secrets-file|fly|oidc (got ${JSON.stringify(note.resolves_from)})`);
    }
    if (note.sensitive != null && !COERCIBLE.bool(note.sensitive)) {
      errors.push("a secret's 'sensitive' must be boolean-ish (true/false/yes/no/1/0)");
    }
  }
  // a TOOL's `secrets: [name]` — which secret NAMES it will need (names only, never
  // values here either); `use/secrets.mjs`'s resolveSecret is the reader that turns a
  // name into a value at run time, gated by that name's OWN `type: secret` declaration
  // (scope + actor) — see act.mjs's binding dispatch. Type-agnostic (like `relations`,
  // below) — harmless on a non-action note, meaningful once a tool references it.
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

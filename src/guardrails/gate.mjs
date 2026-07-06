// src/guardrails/gate.mjs — the enforced guardrails gate.
//
// what: evaluate a tool call against the guardrails module's rule notes; return a
//       deny/ask decision (or null = defer to the host's normal flow).
// why:  the protective layer — enforced on every tool call by the host's
//       PreToolUse hook. A refusal here is policy, not preference.
// how:  rules are notes (`type: rule`, frontmatter action/tool/pattern/reason).
//       severity wins (deny > ask > allow). FAIL-OPEN for an `operator` actor
//       (the default): a malformed rule is skipped, an engine error emits no
//       decision, an `ask` verdict passes through unblocked — never a wrong
//       block, because an interactive human is present to see the run and
//       decide (§I rung 3, the safety floor's fail-CLOSED half — see `gate()`
//       below — is the other half: an unattended `agent` actor gets the
//       opposite defaults, because nobody is watching to catch a silent gap).
//       (evaluate logic harvested from guardrails/engine.mjs, incl. the
//       no-root-wipe JSON-anchor fix — rules match over JSON.stringify(input).)

import { existsSync, statSync } from 'node:fs';
import { parse } from '../notes/note.mjs';
import { itemsDir } from '../notes/store.mjs';
import { readText, list } from '../metal/fs.mjs';

const SEVERITY = { deny: 3, ask: 2, allow: 1 };
const ACTIONS = new Set(Object.keys(SEVERITY));
const cache = new Map(); // dir → { sig, rules }

// A single-atom nested unbounded quantifier — `(a+)+`, `(\w+)*`, `(.*)+`, `([ab]+)*`
// — is the classic catastrophic-backtracking (ReDoS) shape (the inner and outer
// repetition overlap on the same chars). The gate runs synchronously inside the
// host's PreToolUse hook, so a pathological pattern would hang the agent on every
// tool call. Reject these at compile (skip the rule, fail-open) rather than ship a
// DoS. Targets only the single-atom form, so disjoint multi-atom groups like
// `(?:-\S+\s+)*` (linear, safe) are NOT rejected.
const NESTED_QUANTIFIER = /\((?:\?[:!=]<?[=!]?)?(?:\\.|\[[^\]]*\]|[^()\[\]\\])[+*]\)[+*?]/;

/** Compile a rule note → a runtime rule, or null if malformed (skip, never block). */
function compile(note) {
  if (!note || !ACTIONS.has(note.action) || typeof note.pattern !== 'string' || !note.pattern) return null;
  if (NESTED_QUANTIFIER.test(note.pattern)) return null; // ReDoS guard
  try {
    const match = note.match === 'path' ? 'path' : 'all'; // 'path' → test only file-path fields
    return { id: note.id, action: note.action, tool: note.tool || '*', match, re: new RegExp(note.pattern, 'i'), reason: String(note.reason ?? '') };
  } catch {
    return null; // uncompilable pattern → skip this rule only
  }
}

// Shell/exec tools are named differently per host (Bash · bash · shell ·
// exec_command · local_shell · run_command). Canonicalize so a `tool: Bash` rule
// fires on every host, not just Claude Code (case-insensitive + alias).
const SHELL_ALIASES = new Set(['bash', 'shell', 'run_command', 'local_shell', 'exec_command', 'run']);
// File-WRITE tools, likewise named differently per host (Write/Edit/MultiEdit ·
// write_file/replace · apply_patch · str_replace_based_edit_tool · …). Canonicalize to
// `write` so ONE `tool: write` rule protects against direct file writes on EVERY host
// — instead of a rule per host's tool name. READ tools are deliberately absent, so a
// write-only rule (e.g. the .zuzuu/ brain guard) never blocks the agent reading.
const WRITE_ALIASES = new Set([
  'write', 'edit', 'multiedit', 'notebookedit', 'write_file', 'edit_file', 'create_file',
  'replace', 'str_replace', 'str_replace_editor', 'str_replace_based_edit_tool', 'apply_patch', 'patch', 'fs_write',
]);
const canonTool = (t) => {
  const s = String(t ?? '').toLowerCase();
  if (SHELL_ALIASES.has(s)) return 'bash';
  if (WRITE_ALIASES.has(s)) return 'write';
  return s;
};
const toolMatches = (ruleTool, callTool) => ruleTool === '*' || canonTool(ruleTool) === canonTool(callTool);

// Match over the RAW string values of the tool input (the actual command/path),
// NOT JSON.stringify — JSON-escaping turns a real tab/newline into `\t`/`\n`, so
// `\s` stops matching and `rm\t-rf\t/` would slip past a deny rule. Capped to
// bound backtracking input.
const MAX_HAYSTACK = 8192;
// Collapse RUNS of whitespace to a single space BEFORE the cap, so a verb can't be
// pushed past the window by padding: `zz` + 8200 spaces + `note set …` executes as one
// command in the shell, but a naive slice(8192) would truncate before the verb and the
// deny would never fire. Normalizing first keeps every token inside the matched window
// (the rule patterns match on single `\s`, so collapsed whitespace matches identically).
const normalizeWs = (s) => s.replace(/\s+/g, ' ');
function haystackFor(input) {
  if (typeof input === 'string') return normalizeWs(input).slice(0, MAX_HAYSTACK);
  const parts = [];
  const walk = (v) => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(input ?? {});
  return normalizeWs(parts.join('\n')).slice(0, MAX_HAYSTACK);
}

// Field keys that carry a FILE PATH across hosts. A rule with `match: path` tests its
// pattern against ONLY these values (not the file content), so a brain-write guard
// (`pattern: \.zuzuu/`) fires on `file_path: ".zuzuu/…"` but NOT on a normal edit whose
// content merely mentions ".zuzuu/" — no false-positive deny on legitimate writes.
const PATH_KEYS = new Set(['file_path', 'filepath', 'path', 'file', 'filename', 'target_file', 'notebook_path', 'dir', 'directory']);
function pathsFor(input) {
  const parts = [];
  const walk = (v, key) => {
    if (typeof v === 'string') { if (key && PATH_KEYS.has(key)) parts.push(v); }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') for (const [k, val] of Object.entries(v)) walk(val, k.toLowerCase());
  };
  walk(input ?? {}, null);
  return normalizeWs(parts.join('\n')).slice(0, MAX_HAYSTACK); // same anti-padding normalization as haystackFor
}

// The modules the gate enforces rule-notes from. `instructions` is the prepacked
// default (rules + best-practice guidance live together); `guardrails` is kept for
// back-compat so EXISTING projects (seeded before the rename) stay protected.
export const RULE_MODULES = ['instructions', 'guardrails'];

/** Load + compile a module's rule notes, cached on the dir signature. Returns
 *  `{ rules, malformed }` — `malformed` is true when at least one rule note in the
 *  module failed to compile (bad action/pattern/regex) and was silently skipped.
 *  Internal: `loadRules` (below) is the public, rules-array-only surface that
 *  existing callers (and the `ask`/malformed-rule-blind operator path) expect;
 *  `gate()` uses this detailed form to know WHY a rule went missing, for the
 *  agent actor's fail-closed posture. */
function loadRulesDetailed(home, module = 'instructions') {
  const dir = itemsDir(home, module);
  if (!existsSync(dir)) return { rules: [], malformed: false };
  const files = list(dir).filter((f) => f.endsWith('.md'));
  const sig = files.map((f) => { const s = statSync(`${dir}/${f}`); return `${f}:${s.mtimeMs}:${s.size}`; }).sort().join('|');
  const hit = cache.get(dir);
  if (hit && hit.sig === sig) return hit;
  const rules = [];
  let malformed = false;
  for (const f of files) {
    // read by filename-stem id (NOT repo.readNote: the gate derives ids from real
    // filenames and must never let an oddly-named file throw through itemPath's
    // segment guard — it stays fail-open). Bytes go through metal/fs.
    const { note } = parse(readText(`${dir}/${f}`), { id: f.slice(0, -3) });
    const r = compile(note);
    if (r) rules.push(r); else malformed = true;
  }
  const entry = { sig, rules, malformed };
  cache.set(dir, entry);
  return entry;
}

/** Load + compile a module's rule notes, cached on the dir signature. */
export function loadRules(home, module = 'instructions') {
  return loadRulesDetailed(home, module).rules;
}

/**
 * Evaluate a tool call. Matches each rule's pattern over the RAW string values of
 * the input (the real command/path, un-escaped) and canonicalizes the tool name
 * across hosts. Severity wins.
 * @returns {null | {action, rule, reason}}  null = defer to host
 */
export function evaluate(rules, { tool, input }) {
  const haystack = haystackFor(input);     // all string values (commands, content, paths)
  const pathHaystack = pathsFor(input);    // only file-path fields (for `match: path` rules)
  let winner = null;
  for (const r of rules) {
    if (!toolMatches(r.tool, tool)) continue;
    if (!r.re.test(r.match === 'path' ? pathHaystack : haystack)) continue;
    if (!winner || SEVERITY[r.action] > SEVERITY[winner.action]) {
      winner = { action: r.action, rule: r.id, reason: r.reason || `matched rule ${r.id}` };
    }
  }
  return winner;
}

/** The `gate` capability handler: evaluate a call against the home's rules. An explicit
 *  `ctx.module` scopes to one module (tests); otherwise rules from BOTH the new
 *  `instructions` default AND the legacy `guardrails` module are enforced (migration).
 *
 *  `ctx.actor` sets the failure posture (§I rung 3, the safety floor):
 *  - **operator** (default, unchanged): FAIL-OPEN. A malformed rule is skipped, an
 *    engine error returns null (defer/allow), an `ask` verdict is returned AS `ask`
 *    (the caller doesn't block on it — see act.mjs's runGated) — because an
 *    interactive human is present, can see the run's output, and can decide. A wrong
 *    block is worse than a rare unenforced rule.
 *  - **agent**: FAIL-CLOSED. The same three uncertain outcomes — a malformed rule, an
 *    engine error, or an `ask` verdict — all resolve to `deny` instead. An unattended
 *    agent has nobody watching to notice a rule silently failing to compile or an
 *    `ask` silently passing through; "we don't know" must mean "don't run", not
 *    "run anyway".
 *
 *  `ctx.gateActor` — added for the wake-source rung (KTD2, docs/plans/2026-07-06-001-
 *  feat-wake-source-tick-plan.md) — DECOUPLES this failure POSTURE from `ctx.actor`.
 *  `ctx.actor` still governs a completely separate axis elsewhere (write authorization
 *  — `commit`/`grow/run.mjs`'s `startRun`/`advanceRun` refuse any non-`operator` actor;
 *  secrets' operator-only gate). Historically `ctx.actor` ALSO decided this function's
 *  own strict/fail-open posture, conflating the two: a tick-fired durable run needs to
 *  WRITE its run note as `operator` (the one legitimate write door) while its STEPS
 *  gate `agent`-strict (nobody is present to answer an `ask` or notice a silently
 *  dropped rule). `ctx.gateActor`, when present, decides the posture ALONGSIDE
 *  `ctx.actor`; absent (the default — every pre-existing caller), it contributes
 *  nothing and posture derives from `ctx.actor` alone, exactly as before. The one
 *  caller that sets `ctx.gateActor` independently of `ctx.actor` is `grow/run.mjs`'s
 *  step execution for a run stamped `gate_actor: 'agent'` at `startRun` — see its
 *  header comment for the full thread from note field → here.
 *
 *  U3 hardening (wake-source moat review): `strict` is an OR of both axes —
 *  `ctx.actor === 'agent' || ctx.gateActor === 'agent'` — rather than one value
 *  overriding the other (`ctx.gateActor ?? ctx.actor`, the original KTD2 shape). The
 *  `??` form was CORRECT for every caller that exists today (both only ever pass
 *  `gateActor` as `'agent'` or leave it `undefined`), but it was correct by CALLER
 *  DISCIPLINE, not by construction: a caller that ever passed `gateActor` as some
 *  OTHER truthy-but-non-'agent' value while `actor:'agent'` would have SILENTLY
 *  DROPPED to fail-open — strictness could be reduced, never just added. The OR form
 *  makes "add-only strictness" a structural guarantee of `gate()` itself — strict
 *  is true whenever EITHER axis says `'agent'`, and neither axis can ever cancel the
 *  other out. Behaviorally IDENTICAL for every caller in this codebase today (see
 *  gate-actor.test.mjs + run-unattended-gate.test.mjs, both still green).
 */
export function gate(ctx, call) {
  const strict = ctx.actor === 'agent' || ctx.gateActor === 'agent';
  try {
    const modules = ctx.module ? [ctx.module] : RULE_MODULES;
    let malformed = false;
    const rules = modules.flatMap((m) => {
      const loaded = loadRulesDetailed(ctx.home, m);
      if (loaded.malformed) malformed = true;
      return loaded.rules;
    });
    if (strict && malformed) {
      return { action: 'deny', rule: null, reason: 'a guardrail rule failed to compile — denied for an unattended agent actor' };
    }
    const verdict = evaluate(rules, call);
    if (strict && verdict?.action === 'ask') {
      return { action: 'deny', rule: verdict.rule, reason: `${verdict.reason} (ask verdict denied — an unattended agent actor cannot answer 'ask')` };
    }
    return verdict;
  } catch {
    // fail-open for an operator (see above); fail-CLOSED for an agent actor — an
    // engine error under nobody's supervision must never silently allow.
    return strict ? { action: 'deny', rule: null, reason: 'guardrail engine error — denied for an unattended agent actor' } : null;
  }
}

/** Claude Code PreToolUse decision (null = normal flow). */
export function toPreToolUseDecision(verdict) {
  if (!verdict || verdict.action === 'allow') return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: verdict.action,
      permissionDecisionReason: `rule ${verdict.rule}: ${verdict.reason}`,
    },
  };
}

export const clearCache = () => cache.clear(); // tests

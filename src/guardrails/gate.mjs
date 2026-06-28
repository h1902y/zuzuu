// src/guardrails/gate.mjs — the enforced guardrails gate.
//
// what: evaluate a tool call against the guardrails module's rule notes; return a
//       deny/ask decision (or null = defer to the host's normal flow).
// why:  the protective layer — enforced on every tool call by the host's
//       PreToolUse hook. A refusal here is policy, not preference.
// how:  rules are notes (`type: rule`, frontmatter action/tool/pattern/reason).
//       severity wins (deny > ask > allow). FAIL-OPEN: a malformed rule is
//       skipped, an engine error emits no decision — never a wrong block.
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
function haystackFor(input) {
  if (typeof input === 'string') return input.slice(0, MAX_HAYSTACK);
  const parts = [];
  const walk = (v) => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(input ?? {});
  return parts.join('\n').slice(0, MAX_HAYSTACK);
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
  return parts.join('\n').slice(0, MAX_HAYSTACK);
}

// The modules the gate enforces rule-notes from. `instructions` is the prepacked
// default (rules + best-practice guidance live together); `guardrails` is kept for
// back-compat so EXISTING projects (seeded before the rename) stay protected.
export const RULE_MODULES = ['instructions', 'guardrails'];

/** Load + compile a module's rule notes, cached on the dir signature. */
export function loadRules(home, module = 'instructions') {
  const dir = itemsDir(home, module);
  if (!existsSync(dir)) return [];
  const files = list(dir).filter((f) => f.endsWith('.md'));
  const sig = files.map((f) => { const s = statSync(`${dir}/${f}`); return `${f}:${s.mtimeMs}:${s.size}`; }).sort().join('|');
  const hit = cache.get(dir);
  if (hit && hit.sig === sig) return hit.rules;
  const rules = [];
  for (const f of files) {
    // read by filename-stem id (NOT repo.readNote: the gate derives ids from real
    // filenames and must never let an oddly-named file throw through itemPath's
    // segment guard — it stays fail-open). Bytes go through metal/fs.
    const { note } = parse(readText(`${dir}/${f}`), { id: f.slice(0, -3) });
    const r = compile(note);
    if (r) rules.push(r);
  }
  cache.set(dir, { sig, rules });
  return rules;
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
 *  `instructions` default AND the legacy `guardrails` module are enforced (migration). */
export function gate(ctx, call) {
  try {
    const modules = ctx.module ? [ctx.module] : RULE_MODULES;
    const rules = modules.flatMap((m) => loadRules(ctx.home, m));
    return evaluate(rules, call);
  } catch {
    return null; // fail-open: an engine error never blocks
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

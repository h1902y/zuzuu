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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { parse } from '../notes/note.mjs';
import { itemsDir } from '../notes/store.mjs';

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
function compile(item) {
  if (!item || !ACTIONS.has(item.action) || typeof item.pattern !== 'string' || !item.pattern) return null;
  if (NESTED_QUANTIFIER.test(item.pattern)) return null; // ReDoS guard
  try {
    return { id: item.id, action: item.action, tool: item.tool || '*', re: new RegExp(item.pattern, 'i'), reason: String(item.reason ?? '') };
  } catch {
    return null; // uncompilable pattern → skip this rule only
  }
}

// Shell/exec tools are named differently per host (Bash · bash · shell ·
// exec_command · local_shell · run_command). Canonicalize so a `tool: Bash` rule
// fires on every host, not just Claude Code (case-insensitive + alias).
const SHELL_ALIASES = new Set(['bash', 'shell', 'run_command', 'local_shell', 'exec_command', 'run']);
const canonTool = (t) => { const s = String(t ?? '').toLowerCase(); return SHELL_ALIASES.has(s) ? 'bash' : s; };
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

/** Load + compile the guardrails module's rule notes, cached on the dir signature. */
export function loadRules(home, module = 'guardrails') {
  const dir = itemsDir(home, module);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const sig = files.map((f) => { const s = statSync(`${dir}/${f}`); return `${f}:${s.mtimeMs}:${s.size}`; }).sort().join('|');
  const hit = cache.get(dir);
  if (hit && hit.sig === sig) return hit.rules;
  const rules = [];
  for (const f of files) {
    const { item } = parse(readFileSync(`${dir}/${f}`, 'utf8'), { id: f.slice(0, -3) });
    const r = compile(item);
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
  const haystack = haystackFor(input);
  let winner = null;
  for (const r of rules) {
    if (!toolMatches(r.tool, tool)) continue;
    if (!r.re.test(haystack)) continue;
    if (!winner || SEVERITY[r.action] > SEVERITY[winner.action]) {
      winner = { action: r.action, rule: r.id, reason: r.reason || `matched guardrail ${r.id}` };
    }
  }
  return winner;
}

/** The `gate` capability handler: evaluate a call against the home's rules. */
export function gate(ctx, call) {
  try {
    return evaluate(loadRules(ctx.home, ctx.module), call);
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
      permissionDecisionReason: `guardrail ${verdict.rule}: ${verdict.reason}`,
    },
  };
}

export const clearCache = () => cache.clear(); // tests

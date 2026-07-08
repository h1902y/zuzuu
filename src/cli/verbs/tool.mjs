// src/cli/verbs/tool.mjs — the `tool` namespace: the toolkit/tool VIEW (§I.6
// MCP-native model — module = toolkit, `type: action` note = tool, a module's
// declared typed-column schema = the tool's inputSchema). Read-only: the basis for
// a future real `tools/list`/`tools/call` MCP endpoint, not the endpoint itself.
// Binding DISPATCH (shell/agent/mcp) lives in use/act.mjs + use/workflow.mjs's
// note-ref composition — this file only SHOWS the contract, it never runs anything.
// Composed into THE table by ../commands.mjs.

import { open } from '../../serve/api.mjs';
import { readEnvelopes, searchRows } from '../../notes/rows.mjs';
import { readManifest } from '../../notes/module.mjs';
import { bindingOf, promptOf } from '../../notes/validate.mjs';
import { toon } from '../../notes/toon.mjs';
import { fail, emit } from '../args.mjs';

/** Every tool (`type: action` note) across every module, hydrated to its full
 *  envelope (module injected) — one cross-module search, not one open per module. */
function everyTool(home) {
  return searchRows(home, { module: '', type: 'action', limit: 10000 }).items;
}

/** The module's declared typed-column schema doubles as the tool's `inputSchema`
 *  (§I.6: "its FieldDefs ARE the tool's inputSchema") — [] on a schemaless module. */
const inputSchemaOf = (manifest) => (Array.isArray(manifest.fields) ? manifest.fields : []);

/** The binding's own run/prompt/mcp TARGET — the thing that actually dispatches. */
function targetOf(note, binding) {
  if (binding === 'shell') return note.run ?? null;
  if (binding === 'agent') return promptOf(note);
  if (binding === 'mcp') return note.mcp ?? null;
  return null;
}

/** The toolkit's HITL posture — a REAL, checkable behavior (use/act.mjs's
 *  `runGated`), not an aspirational flag the engine doesn't have: a module that
 *  declares a `policy.run.allow` list restricts every shell run in it to that
 *  allowlist (+ repo-local scripts); a module with none has NO allowlist axis at
 *  all — any shell command may run, subject only to the guardrails gate's deny
 *  rules. Surfacing this (rather than inventing a `protected: true` field) keeps
 *  `tool show` honest about what's actually enforced today. */
function hitlNote(manifest) {
  const allow = manifest.policy?.run?.allow;
  if (Array.isArray(allow) && allow.length) {
    return `protected — this toolkit declares a run.allow policy: shell runs are restricted to [${allow.join(', ')}] (+ repo-local scripts); the guardrails gate evaluates every run regardless`;
  }
  return 'open — no run.allow policy declared on this toolkit; shell runs are unrestricted beyond the guardrails gate (a deny rule can still block one)';
}

/** One tool's full contract — the shape both `tool list` (per-tool row) and
 *  `tool show` (one tool, full detail) project from. */
function contractOf(note, manifest) {
  const binding = bindingOf(note);
  return {
    addr: `${note.module}:${note.id}`,
    module: note.module,
    binding,
    summary: note.title || note.id,
    inputSchema: inputSchemaOf(manifest),
    secrets: Array.isArray(note.secrets) ? note.secrets : [],
    target: targetOf(note, binding),
  };
}

export const toolRows = [
  {
    path: ['tool', 'list'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'tool list [--json]',
    summary: 'your tools, grouped by toolkit — what each does and needs',
    io: { params: [], flags: {} },
    handler: ({ cwd, log, json }) => {
      const zz = open(cwd);
      const manifests = new Map();
      const manifestOf = (m) => { if (!manifests.has(m)) manifests.set(m, readManifest(zz.home, m)); return manifests.get(m); };
      const contracts = everyTool(zz.home).map((note) => contractOf(note, manifestOf(note.module)));
      if (json) {
        const toolkits = [...manifests.keys()].sort().map((module) => ({
          module, title: manifestOf(module).title ?? module,
          tools: contracts.filter((c) => c.module === module),
        }));
        log(JSON.stringify({ toolkits }));
        return 0;
      }
      const rows = contracts.map((c) => ({
        module: c.module, addr: c.addr, binding: c.binding, summary: c.summary,
        params: c.inputSchema.map((f) => f.name).join('|'),
        secrets: c.secrets.join('|'),
      }));
      log(toon('tools', rows, ['module', 'addr', 'binding', 'summary', 'params', 'secrets'], ['zz tool show <module:id>']));
      return 0;
    },
  },
  {
    path: ['tool', 'show'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'tool show <module:id> [--json]',
    summary: "one tool in full — its inputs, secrets, and what it runs",
    io: { params: ['addr'], flags: {} },
    handler: ({ args, cwd, log, json }) => {
      const addr = String(args._[0] ?? '');
      const i = addr.indexOf(':');
      if (i <= 0 || i >= addr.length - 1) return fail(log, 'usage: zz tool show <module:id>', json);
      const module = addr.slice(0, i);
      const zz = open(cwd);
      const [note] = readEnvelopes(zz.home, [addr]);
      if (!note) return fail(log, `no note '${addr}'`, json);
      if (note.type !== 'action') return fail(log, `'${addr}' is a '${note.type}' note, not a tool (type: action)`, json);
      const manifest = readManifest(zz.home, module);
      const c = contractOf(note, manifest);
      const hitl = hitlNote(manifest);
      if (json) { log(JSON.stringify({ ...c, hitl })); return 0; }
      log(toon('tool', [{ addr: c.addr, binding: c.binding, summary: c.summary, secrets: c.secrets.join('|') || '(none)' }], ['addr', 'binding', 'summary', 'secrets']));
      if (c.inputSchema.length) log(toon('inputSchema', c.inputSchema, ['name', 'type', 'required', 'label']));
      else log('inputSchema[0]: (none — this toolkit is schemaless)');
      const targetStr = c.binding === 'mcp' ? JSON.stringify(c.target) : (c.target ?? '(none)');
      log(`target (${c.binding}): ${targetStr}`);
      log(hitl);
      return 0;
    },
  },
];

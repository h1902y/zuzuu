// src/serve/wire.mjs — wire every capability into the one registry.
//
// what: registerAll() binds the built verbs to serve/dispatch's registry so
//       `invoke(home, module, verb, …)` dispatches them. The single import a
//       host (CLI, daemon, plugin) needs to light up the capability surface.
// why:  the registry is the one dispatch table (R: one registry, no per-module
//       code). Keeping registration in one file makes the verb set legible and
//       keeps handlers free of self-registration side-effects (testable in
//       isolation, registered on purpose).
// how:  thin ctx-shaped adapters where a handler's native signature differs
//       (only `query`, which is project-wide over home). Idempotent.
//
// The dispatched verbs: query · check · act · view · flow · validate — every `use/`
// verb that targets a module. (Rung 8 routed view/flow/validate through here too; they
// were direct façade bindings before — an audit smell, since they skipped the one
// dispatch table + its permission/actor gate.) `review` is the HUMAN gate (the moat's
// only door — deliberately NEVER registered, so an agent has no capability handler to
// approve its own proposal) and the guardrails `gate` is called directly by act/hook
// (reachable only via `host hook PreToolUse`) — neither rides the registry.

import { register, clear, list } from './dispatch.mjs';
import { queryData } from '../use/query.mjs';
import { act } from '../use/act.mjs';
import { check, validateProject } from '../use/check.mjs';
import { viewNote } from '../use/view.mjs';
import { runWorkflow } from '../use/workflow.mjs';

let wired = false;

/** Bind all capabilities. Idempotent — safe to call from any host entry. */
export function registerAll() {
  if (wired) return list();
  register('query', (ctx, opts = {}) => queryData(ctx.home, { module: ctx.module, ...opts }), { permission: 'read' });
  register('check', (ctx, opts = {}) => check(ctx, opts), { permission: 'read' });
  register('act', (ctx, id, inputs = {}) => act(ctx, id, inputs), { permission: 'run' });
  register('view', (ctx, id, opts = {}) => viewNote(ctx.home, ctx.module, id, opts), { permission: 'read' });
  register('flow', (ctx, id, inputs = {}) => runWorkflow(ctx.home, ctx.module, id, inputs), { permission: 'run' });
  // validate is project-wide when module is '' (readManifest('') falls back to the
  // universal set, so 'validate' passes the exposure gate either way).
  register('validate', (ctx) => validateProject(ctx.home, ctx.module), { permission: 'read' });
  wired = true;
  return list();
}

/** Test helper — reset registration. */
export function resetCapabilities() { clear(); wired = false; }

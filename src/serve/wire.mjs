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
// The dispatched verbs: query · check · act. `review` is the HUMAN gate
// (interactive, never agent-invoked) and the guardrails `gate` is called
// directly by act/hook — neither rides the registry.

import { register, clear, list } from './dispatch.mjs';
import { queryData } from '../use/query.mjs';
import { act } from '../use/act.mjs';
import { check } from '../use/check.mjs';

let wired = false;

/** Bind all capabilities. Idempotent — safe to call from any host entry. */
export function registerAll() {
  if (wired) return list();
  register('query', (ctx, opts = {}) => queryData(ctx.home, { module: ctx.module, ...opts }), { permission: 'read' });
  register('check', (ctx, opts = {}) => check(ctx, opts), { permission: 'read' });
  register('act', (ctx, id, inputs = {}) => act(ctx, id, inputs), { permission: 'run' });
  wired = true;
  return list();
}

/** Test helper — reset registration. */
export function resetCapabilities() { clear(); wired = false; }

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
// The five verbs: query · act · enhance · check are auto-invokable here; the
// fifth, `review`, is the HUMAN gate — interactive, never agent-invoked — so it
// is deliberately NOT registered. gate (the guardrails check) rides along.

import { register, clear, list } from './dispatch.mjs';
import { queryData } from '../use/query.mjs';
import { act } from '../use/act.mjs';
import { enhance } from '../loop/enhance.mjs';
import { check } from '../use/check.mjs';
import { gate } from '../guardrails/gate.mjs';

let wired = false;

/** Bind all capabilities. Idempotent — safe to call from any host entry. */
export function registerAll() {
  if (wired) return list();
  register('query', (ctx, opts = {}) => queryData(ctx.home, { module: ctx.module, ...opts }), { permission: 'read' });
  register('check', (ctx, opts = {}) => check(ctx, opts), { permission: 'read' });
  register('act', (ctx, id, inputs = {}) => act(ctx, id, inputs), { permission: 'run' });
  register('enhance', (ctx, opts = {}) => enhance(ctx, opts), { permission: 'write' });
  register('gate', (ctx, call) => gate(ctx, call), { permission: 'read' });
  wired = true;
  return list();
}

/** Test helper — reset registration. */
export function resetCapabilities() { clear(); wired = false; }

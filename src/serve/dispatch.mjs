// src/serve/dispatch.mjs — the one capability registry.
//
// what: the single place capabilities (verbs over a module's notes) are
//       registered and dispatched. A capability is a named handler; a module
//       declares which it exposes (in its manifest); `invoke` runs the handler
//       with the module's context.
// why:  collapses the old three vocabularies (a manifest map + boolean hooks +
//       named exports + a synthesize-vs-handwrite fork) into ONE: register a
//       handler, declare it in a manifest, invoke it. No per-module code.
// how:  a Map of name→{handler, permission}. invoke() is fail-soft (try-wrapped
//       — a broken capability degrades, never crashes the host). Zero-dep.
//
// THE MOAT, at dispatch (Rung 8): `invoke` takes the actor in its `ctx` (stamped at the
// entry boundary — CLI=operator, host hook=agent — never read from agent-controllable
// input). A `write`-permission capability is operator-only: an agent-stamped invoke of one
// is refused before the handler runs. No verb is `write` today (Project writes flow through
// `commit`/the human gate, not the registry), so this is forward-looking defense-in-depth
// + a correctness invariant for any future write capability.

import { readManifest } from '../notes/module.mjs';

const REGISTRY = new Map();

/**
 * Register a capability handler.
 * @param {string} name
 * @param {(ctx: {home,module,manifest}, ...args) => any} handler
 * @param {{permission?: 'read'|'write'|'run'}} [opts]
 */
export function register(name, handler, opts = {}) {
  REGISTRY.set(name, { handler, permission: opts.permission ?? 'read' });
}

export const list = () => [...REGISTRY.keys()].sort();
export const clear = () => REGISTRY.clear(); // tests

/**
 * Invoke a capability for a module. Fail-soft: returns
 * `{ ok:false, ... }` rather than throwing, so a broken capability or a module
 * that doesn't expose it degrades the host's normal flow, never breaks it.
 * @param {{actor?: 'operator'|'agent'}} [ctx]  the trust context, stamped at the entry
 *   boundary (defaults to operator — the fail-open default; the agent boundary, the host
 *   hook, must explicitly stamp 'agent'). The actor rides into the handler's ctx too.
 * @returns {{ ok:true, value:any } | { ok:false, missing?:boolean, denied?:boolean, error?:string }}
 */
export function invoke(home, module, name, ctx = {}, ...args) {
  const cap = REGISTRY.get(name);
  if (!cap) return { ok: false, missing: true, error: `no capability '${name}'` };
  // the moat at dispatch: a write capability is operator-only (forward-looking — no verb
  // is `write` today, so this only ever fires for a future write cap under an agent).
  if (cap.permission === 'write' && ctx.actor === 'agent') {
    return { ok: false, denied: true, error: `'${name}' requires an operator (write capability)` };
  }
  const manifest = readManifest(home, module);
  if (!manifest.capabilities.includes(name)) {
    return { ok: false, denied: true, error: `module '${module}' does not expose '${name}'` };
  }
  try {
    return { ok: true, value: cap.handler({ home, module, manifest, actor: ctx.actor ?? 'operator' }, ...args) };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

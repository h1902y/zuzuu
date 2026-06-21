// zuzuu/kernel/capability.mjs — the one capability registry.
//
// what: the single place capabilities (verbs over a module's zus) are
//       registered and dispatched. A capability is a named handler; a module
//       declares which it exposes (in its manifest); `invoke` runs the handler
//       with the module's context.
// why:  collapses the old three vocabularies (a manifest map + boolean hooks +
//       named exports + a synthesize-vs-handwrite fork) into ONE: register a
//       handler, declare it in a manifest, invoke it. No per-module code.
// how:  a Map of name→{handler, permission}. invoke() is fail-soft (try-wrapped
//       — a broken capability degrades, never crashes the host). Zero-dep.

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

export const get = (name) => REGISTRY.get(name) ?? null;
export const has = (name) => REGISTRY.has(name);
export const list = () => [...REGISTRY.keys()].sort();
export const clear = () => REGISTRY.clear(); // tests

/**
 * Invoke a capability for a module. Fail-soft: returns
 * `{ ok:false, ... }` rather than throwing, so a broken capability or a module
 * that doesn't expose it degrades the host's normal flow, never breaks it.
 * @returns {{ ok:true, value:any } | { ok:false, missing?:boolean, denied?:boolean, error?:string }}
 */
export function invoke(home, module, name, ...args) {
  const cap = REGISTRY.get(name);
  if (!cap) return { ok: false, missing: true, error: `no capability '${name}'` };
  const manifest = readManifest(home, module);
  if (!manifest.capabilities.includes(name)) {
    return { ok: false, denied: true, error: `module '${module}' does not expose '${name}'` };
  }
  try {
    return { ok: true, value: cap.handler({ home, module, manifest }, ...args) };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** The schema/introspection of a capability — the agent's discovery surface. */
export function describe(name) {
  const cap = REGISTRY.get(name);
  return cap ? { name, permission: cap.permission } : null;
}

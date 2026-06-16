// zuzuu/module/capability-registry.mjs — the platform-owned catalogue of
// capability descriptors (the "lego blocks"). Pure registry mechanics; the
// resolver (capabilities.mjs) consumes descriptors' build() to synthesize a
// module's hook set. A descriptor:
//   { name, category?, hostBinding?, grant?, configSchema?, build? }
// grant = the scoped-authority descriptor: { scope, audited }.
const CAPABILITIES = new Map();

/** Register/overwrite a capability descriptor; returns the stored record. */
export function registerCapability(name, descriptor = {}) {
  const record = { name, ...descriptor };
  CAPABILITIES.set(name, record);
  return record;
}
export function getCapability(name) { return CAPABILITIES.get(name) ?? null; }
export function hasCapability(name) { return CAPABILITIES.has(name); }
export function listCapabilities() { return [...CAPABILITIES.values()]; }
/** Tests only. */
export function clearCapabilities() { CAPABILITIES.clear(); }

// zuzuu/commands/module/read.mjs — the `zuzuu module` read/data surface.
//
// Pure documents over the one envelope format + the module contract: a module's
// items, its served payload schema, its manifest, and the all-modules overview
// (the web daemon's batching endpoint — counts + top-3 titles + pending in ONE
// process). Declarative (manifest-only) modules are first-class. Fail-soft.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listModuleItems } from '../../module/items.mjs';
import { listProposals } from '../../module/proposal.mjs';
import { PAYLOAD_SCHEMAS } from '../../module/envelope.mjs';
import { modulesOf, moduleOf, get as getAdapter } from '../../module/registry.mjs';

/** Pure: one module's envelope items + parse errors (the --json document). */
export function moduleItemsData(agentDir, module, manifest = null) {
  const m = manifest ?? moduleOf(agentDir, module)?.manifest;
  const { items, errors } = listModuleItems(agentDir, module, { itemsDir: m?.itemsDir });
  return { module, count: items.length, items, errors };
}

/**
 * Pure: the payload schema served for a module — the home's seeded
 * `<module>/schema.json` when present and parseable (humans may extend it),
 * else the built-in default. Never throws.
 */
export function moduleSchemaData(agentDir, module) {
  const seeded = join(agentDir, module, 'schema.json');
  if (existsSync(seeded)) {
    try { return { module, source: 'home', schema: JSON.parse(readFileSync(seeded, 'utf8')) }; }
    catch { /* fall through to the built-in */ }
  }
  return { module, source: 'builtin', schema: PAYLOAD_SCHEMAS[module] ?? null };
}

/**
 * Pure: one module's manifest document (home module.json when present,
 * built-in fallback), or null for an unknown module.
 */
export function moduleManifestData(agentDir, module) {
  const entry = moduleOf(agentDir, module);
  if (!entry) return null;
  return {
    module: entry.id,
    source: entry.manifestSource,
    declarative: entry.declarative,
    ...(entry.manifestError ? { error: entry.manifestError } : {}),
    manifest: entry.manifest,
  };
}

/** Pending-proposal count for one module (dir-shaped adapters override). */
function pendingCount(agentDir, entry) {
  try {
    const a = getAdapter(entry.id);
    if (a && typeof a.listProposals === 'function') return a.listProposals(agentDir).length;
    return listProposals(agentDir, entry.id).length;
  } catch {
    return 0;
  }
}

/**
 * Pure: the overview document — EVERY module (built-in + declarative) with
 * manifest/ui, item + pending counts and the top-3 item titles, computed in
 * ONE process (the web daemon's batching endpoint — kills 5-spawn cycles).
 * Fail-soft per module: a broken one reports zeros + its manifestError.
 */
export function moduleOverviewData(agentDir) {
  const modules = modulesOf(agentDir).map((entry) => {
    let items = [], errors = [];
    try {
      ({ items, errors } = listModuleItems(agentDir, entry.id, { itemsDir: entry.manifest?.itemsDir }));
    } catch { /* unreadable → zeros */ }
    return {
      id: entry.id,
      title: entry.manifest?.title ?? entry.id,
      tagline: entry.manifest?.tagline ?? '',
      ui: entry.manifest?.ui ?? {},
      kinds: entry.manifest?.kinds ?? [],
      declarative: entry.declarative,
      composed: !!entry.composed,
      enabled: entry.manifest?.enabled !== false,
      capabilities: Object.keys(entry.manifest?.capabilities ?? {}),
      ...(entry.manifestError ? { manifestError: entry.manifestError } : {}),
      counts: { items: items.length, pending: pendingCount(agentDir, entry), errors: errors.length },
      top: items.slice(0, 3).map((i) => i.title ?? i.id),
    };
  });
  return { modules };
}

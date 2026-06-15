// zuzuu/module/capabilities.mjs — the RESOLVER. Given a normalized manifest
// that declares `capabilities:{...}`, synthesize the module-shaped hook set the
// spine consumes (adapter / miner / digestSection / recall / run + the
// top-level validate/applyProposal/propose that registry.invoke reaches).
//
// This is what makes "a fusion of knowledge + actions" a DECLARATION, not code:
// each declared capability's descriptor.build() contributes a fragment; the
// resolver merges them. Fail-soft — an unknown/failing capability is skipped
// with a recorded note (surfaced by doctor), never a crash.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCapability } from './capability-registry.mjs';
import './capability-builtins.mjs'; // side effect: register the host-internal §A blocks

/** Default schema loader: read <agentDir>/<id>/<manifest.schema||schema.json>. */
function defaultLoadSchema(agentDir, manifest) {
  const p = join(agentDir, manifest.id, manifest.schema || 'schema.json');
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}

/**
 * Synthesize a module object from a manifest's declared capabilities.
 * @param {string} agentDir
 * @param {object} manifest  a normalizeManifest() result (with .capabilities)
 * @param {{loadSchema?: (agentDir, manifest)=>object}} [opts]
 * @returns {object|null}  module-shaped {manifest, adapter, digestSection, [miner], [recall], [run], validate, applyProposal, [propose], capabilityNotes} — or null when no capabilities declared.
 */
export function synthesizeModule(agentDir, manifest, opts = {}) {
  const caps = manifest?.capabilities && typeof manifest.capabilities === 'object' ? manifest.capabilities : {};
  const names = Object.keys(caps);
  if (!names.length) return null;

  const schema = (opts.loadSchema ? opts.loadSchema(agentDir, manifest) : defaultLoadSchema(agentDir, manifest)) || {};
  const adapter = { name: manifest.id };
  let miner = null, digestSection = null, recall = null, run = null, list = null;
  const notes = [];

  for (const name of names) {
    const desc = getCapability(name);
    if (!desc || typeof desc.build !== 'function') { notes.push(`unknown capability '${name}'`); continue; }
    let frag;
    try { frag = desc.build({ agentDir, manifest, config: caps[name], schema }) || {}; }
    catch (e) { notes.push(`capability '${name}' build failed: ${e?.message ?? e}`); continue; }
    if (frag.adapter) Object.assign(adapter, frag.adapter);
    if (frag.miner) miner = frag.miner;
    if (frag.digestSection) digestSection = frag.digestSection;
    if (frag.recall) recall = frag.recall;
    if (frag.run) run = frag.run;
    if (frag.list) list = frag.list;
  }

  // Default digest section (count line) when no digest capability contributed one.
  if (!digestSection) {
    digestSection = (aDir) => {
      let count = 0;
      try { count = (list ? list(aDir) : { items: [] }).items.length; } catch { count = 0; }
      const lines = [`## ${manifest.title}`, count ? `${count} item(s).` : '(no items yet)'];
      return { lines, data: { count, renderedCount: 0 } };
    };
  }

  const module = { manifest, adapter, digestSection, capabilityNotes: notes };
  if (miner) module.miner = miner;
  if (recall) module.recall = recall;
  if (run) module.run = run;
  // Top-level hooks registry.invoke() reaches (entry.module[hook]).
  if (typeof adapter.validate === 'function') module.validate = adapter.validate;
  if (typeof adapter.apply === 'function') module.applyProposal = adapter.apply;
  if (miner) module.propose = miner.propose;
  return module;
}

// No resolver cache by design: modulesOf() re-reads each manifest from disk
// every call (the `.git` model — ground truth lives on disk), and synthesis is a
// few build() calls. A cache keyed on agentDir+id+version would serve a stale
// validator after an in-place manifest/schema edit with no version bump (e.g. in
// the long-lived web daemon). Synthesize fresh.

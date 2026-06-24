// src/grow/propose.mjs — the proposal queue.
//
// what: a proposal is an evidence-backed, typed change to a module's notes
//       (create · update · delete · relate · deprecate) awaiting human review.
// why:  the bridge from observation to the Project. NOTHING is written without a
//       human approving a proposal — the moat. Proposals are staged, not applied.
// how:  one JSON file per proposal under `<module>/proposals/<id>.json`;
//       archived (not deleted) on decision. Zero-dep, fail-soft.

import { existsSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readJson, writeJson } from '../notes/store.mjs';
import { ensureModuleManifest } from '../notes/module-templates.mjs';

const OPS = new Set(['create', 'update', 'delete', 'relate', 'deprecate']);
const propDir = (home, module) => join(home, module, 'proposals');
const archiveDir = (home, module) => join(propDir(home, module), 'archive');

/** Deterministic proposal id from its content (idempotent — dedups re-proposals). */
const propId = (p) => 'prop-' + createHash('sha256').update(JSON.stringify([p.op, p.module, p.target, p.change])).digest('hex').slice(0, 8);

/**
 * Stage a proposal. Returns the record (with id), or null if malformed.
 * @param {{op,module,target?,change,rationale?,evidence?,confidence?,score?}} p
 */
export function createProposal(home, module, p) {
  if (!OPS.has(p.op)) return null;
  const id = propId({ ...p, module });
  const record = {
    id, op: p.op, module, target: p.target ?? null, change: p.change ?? {},
    rationale: p.rationale ?? '', evidence: p.evidence ?? [],
    confidence: p.confidence ?? null, score: p.score ?? 0, status: 'pending',
  };
  const file = join(propDir(home, module), `${id}.json`);
  if (existsSync(file)) return { ...record, duplicate: true }; // already pending — don't re-stage
  // No prebuilt modules: a module materializes when the loop first routes to it.
  // Mint its manifest (structural — the human gate still governs the ITEMS) so the
  // grown module is well-formed + enumerable (notes/module.listModules needs it).
  ensureModuleManifest(home, module);
  writeJson(file, record);
  return record;
}

export function listProposals(home, module) {
  const dir = propDir(home, module);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => readJson(join(dir, f))).filter(Boolean) // a corrupt proposal file is skipped, not fatal
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); // ranked — the eval lever
}

export const readProposal = (home, module, id) => {
  const f = join(propDir(home, module), `${id}.json`);
  return existsSync(f) ? readJson(f) : null;
};

/** Move a decided proposal to archive/ (never deleted — the audit trail). */
export function archiveProposal(home, module, id, status) {
  const from = join(propDir(home, module), `${id}.json`);
  if (!existsSync(from)) return false;
  const rec = readJson(from);
  if (!rec) return false;
  rec.status = status;
  writeJson(join(archiveDir(home, module), `${id}.json`), rec);
  renameSync(from, join(archiveDir(home, module), `${id}.json.applied`));
  return true;
}

// src/grow/propose.mjs — the proposal queue.
//
// what: a proposal is an evidence-backed, typed change to a module's notes
//       (create · update · delete · relate · deprecate) awaiting human review.
// why:  the bridge from observation to the brain. NOTHING is written without a
//       human approving a proposal — the moat. Proposals are staged, not applied.
// how:  one JSON file per proposal under `<module>/proposals/<id>.json`;
//       archived (not deleted) on decision. Zero-dep, fail-soft.

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

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
  mkdirSync(propDir(home, module), { recursive: true });
  writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  return record;
}

const readJsonSafe = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

export function listProposals(home, module) {
  const dir = propDir(home, module);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => readJsonSafe(join(dir, f))).filter(Boolean) // a corrupt proposal file is skipped, not fatal
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); // ranked — the eval lever
}

export const readProposal = (home, module, id) => {
  const f = join(propDir(home, module), `${id}.json`);
  return existsSync(f) ? readJsonSafe(f) : null;
};

/** Move a decided proposal to archive/ (never deleted — the audit trail). */
export function archiveProposal(home, module, id, status) {
  const from = join(propDir(home, module), `${id}.json`);
  if (!existsSync(from)) return false;
  mkdirSync(archiveDir(home, module), { recursive: true });
  const rec = JSON.parse(readFileSync(from, 'utf8'));
  rec.status = status;
  writeFileSync(join(archiveDir(home, module), `${id}.json`), JSON.stringify(rec, null, 2) + '\n');
  renameSync(from, join(archiveDir(home, module), `${id}.json.applied`));
  return true;
}

// src/grow/stage.mjs — the staged-change queue (the loop's 2nd beat).
//
// what: a staged change is an evidence-backed, typed change to a module's notes
//       (create · update · delete · relate · unrelate · deprecate) awaiting human review.
// why:  the bridge from observation to the Project. NOTHING is written without a
//       human approving a staged change — the moat. Staged, not applied. (Named to
//       mirror git: staged → review → evolved, as staged → commit.)
// how:  one JSON file per staged change under `<module>/staged/<id>.json`;
//       archived (not deleted) on decision. Zero-dep, fail-soft.

import { existsSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readJson, writeJson } from '../notes/store.mjs';
import { ensureModuleManifest } from '../notes/module-templates.mjs';

const OPS = new Set(['create', 'update', 'delete', 'relate', 'unrelate', 'deprecate']);
const stagedDir = (home, module) => join(home, module, 'staged');
const archiveDir = (home, module) => join(stagedDir(home, module), 'archive');

/** Deterministic id from its content (idempotent — dedups re-staging). */
const stageId = (p) => 'stg-' + createHash('sha256').update(JSON.stringify([p.op, p.module, p.target, p.change])).digest('hex').slice(0, 8);

/**
 * Stage a change. Returns the record (with id), or null if malformed.
 * `source` is the provenance pointer (U4 / R6) — { producer, sessions, locator } —
 * so a note can link back to where it was born; null when the producer omits it.
 * @param {{op,module,target?,change,rationale?,evidence?,confidence?,score?,source?}} p
 */
export function stageChange(home, module, p) {
  if (!OPS.has(p.op)) return null;
  const id = stageId({ ...p, module });
  const record = {
    id, op: p.op, module, target: p.target ?? null, change: p.change ?? {},
    rationale: p.rationale ?? '', evidence: p.evidence ?? [],
    confidence: p.confidence ?? null, score: p.score ?? 0,
    source: p.source ?? null, status: 'pending',
  };
  const file = join(stagedDir(home, module), `${id}.json`);
  if (existsSync(file)) return { ...record, duplicate: true }; // already staged — don't re-stage
  // No prebuilt modules: a module materializes when the loop first routes to it.
  // Mint its manifest (structural — the human gate still governs the ITEMS) so the
  // grown module is well-formed + enumerable (notes/module.listModules needs it).
  ensureModuleManifest(home, module);
  writeJson(file, record);
  return record;
}

export function listStaged(home, module) {
  const dir = stagedDir(home, module);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => readJson(join(dir, f))).filter(Boolean) // a corrupt staged file is skipped, not fatal
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); // ranked — the eval lever
}

export const readStaged = (home, module, id) => {
  const f = join(stagedDir(home, module), `${id}.json`);
  return existsSync(f) ? readJson(f) : null;
};

/** Move a decided staged change to archive/ (never deleted — the audit trail). */
export function archiveStaged(home, module, id, status) {
  const from = join(stagedDir(home, module), `${id}.json`);
  if (!existsSync(from)) return false;
  const rec = readJson(from);
  if (!rec) return false;
  rec.status = status;
  writeJson(join(archiveDir(home, module), `${id}.json`), rec);
  renameSync(from, join(archiveDir(home, module), `${id}.json.applied`));
  return true;
}

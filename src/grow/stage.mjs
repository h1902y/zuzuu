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
import { readNote } from '../notes/repo.mjs';
import { projectChange, lookupId } from './commit.mjs';
import { secretValueLeaks } from '../notes/validate.mjs';

const OPS = new Set(['create', 'update', 'delete', 'relate', 'unrelate', 'deprecate']);
const stagedDir = (home, module) => join(home, module, 'staged');
const archiveDir = (home, module) => join(stagedDir(home, module), 'archive');

/** Deterministic id from its content (idempotent — dedups re-staging). */
const stageId = (p) => 'stg-' + createHash('sha256').update(JSON.stringify([p.op, p.module, p.target, p.change])).digest('hex').slice(0, 8);

// fail-soft current-note read for secretStageRefusal below: an unsafe/`../` id
// THROWS inside itemPath (via notes/repo.readNote) — here that's "no current note",
// same as a genuinely absent one; the real write door refuses an unsafe id on its
// own later, this is only a pre-write PREVIEW read.
const readCurrentSafe = (home, module, id) => { try { return id ? readNote(home, module, id) : null; } catch { return null; } };

/**
 * BLOCKER B1(a) (audit 2026-07-03-secrets-review.md) — `<module>/staged/*.json` is
 * git-TRACKED, not transient: a poisoned `type: secret` change with a value-bearing
 * field must never touch that file, not even for the length of one `git status` (the
 * OLD behavior — the refusal fired only at `approve`/commit time, AFTER the plaintext
 * already sat on disk, rendered in a CLI diff, and rode a daemon HTTP response). Fix:
 * project what this staged change would BECOME — the SAME create/update/relate/
 * unrelate/deprecate projection `commit()` uses (`projectChange`, imported verbatim,
 * not re-implemented, so this is PROVABLY the identical shape `validateNote` would see
 * at commit time) — and scan it with the SAME `secretValueLeaks` (S1/S2) validateNote's
 * own type:secret check uses. Actor-BLIND by design (stage has no actor branch — an
 * agent and a human propose through the identical function, so refusing here refuses
 * both uniformly; see docs/audits/2026-07-03-secrets-review.md's "Fixed" section).
 * Returns an error string, or null when the projected change is clean / not secret-shaped.
 */
function secretStageRefusal(home, module, p) {
  if (!OPS.has(p.op)) return null; // let the (pre-existing) bad-op refusal below handle it
  const change = p.change ?? {};
  const staged = { op: p.op, target: p.target, id: p.id, change, source: p.source };
  const current = p.op === 'create' ? null : readCurrentSafe(home, module, lookupId(staged, change));
  const { after } = projectChange(staged, current);
  if (!after || after.type !== 'secret') return null;
  const leaks = secretValueLeaks(after);
  if (!leaks.length) return null;
  return `refused at stage: a secret declaration must never carry a value-bearing field (found: ${leaks.join(', ')}) — the value lives on the host, never in the note (see docs/guide/Secrets.md)`;
}

/**
 * Stage a change. Returns the record (with id) on success, `{ error }` when refused
 * (B1(a) — a poisoned type:secret value never reaches disk, never mind a review),
 * or `null` if malformed (bad op). A caller that only checked truthiness before this
 * fix must now also check `.id` (a successful record always has one; `{error}` never
 * does) — every in-repo caller (observe/subscribe/runs-miner/the CLI `stage` verb) was
 * updated alongside this.
 * `source` is the provenance pointer (U4 / R6) — { producer, sessions, locator } —
 * so a note can link back to where it was born; null when the producer omits it.
 * @param {{op,module,target?,change,rationale?,evidence?,confidence?,score?,source?}} p
 */
export function stageChange(home, module, p) {
  if (!OPS.has(p.op)) return null;
  const refusal = secretStageRefusal(home, module, p);
  if (refusal) return { error: refusal };
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

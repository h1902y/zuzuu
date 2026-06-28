// src/grow/plan.mjs — the change-set: review a SET, apply it as ONE generation.
//
// what: a stateless, content-addressed plan over a module's pending staged set.
//       `planFor` renders the whole set's diff + a content id (writes nothing);
//       `applyPlan` re-checks that id (TOCTOU guard), then applies every member as
//       ONE transactional generation (all-or-nothing). The Terraform plan→apply
//       model, mapped onto stage→review→evolve.
// why:  the gate should approve a SET with full context, not one card at a time
//       (one decision, one commit) — strictly more aligned with "the gate is the
//       moat". A content-addressed plan needs no new on-disk entity: the id IS the
//       hash of the pending set, so `apply` refuses a set that changed since `plan`.
// how:  reuse projectChange (preview, from grow/commit) for the dry-run diff, then hand
//       the whole staged set to `commit` (the one write boundary) as ONE batch — commit
//       writes all-or-nothing (reverting the items tree on failure) and mints ONE
//       generation for the batch. The Terraform plan→apply, on the single writer. Zero-dep.

import { createHash } from 'node:crypto';
import { readNote as readNoteRaw } from '../notes/repo.mjs';
import { listStaged, archiveStaged } from './stage.mjs';
import { projectChange, commit } from './commit.mjs';
import { diffNote } from '../use/diff.mjs';

// fail-soft preview read: an unsafe/`../` id throws in itemPath (inside repo.readNote)
// — for a dry-run we catch it and treat it as "no current note" (apply still refuses
// it via applyChange's guard).
const readNote = (home, module, id) => {
  try { return readNoteRaw(home, module, id); } catch { return null; }
};
const lookupId = (s) => s.op === 'relate' ? s.change?.from : (s.target ?? s.change?.id ?? s.id);
// the plan id is the content hash of the pending member set — same trick as stageId
const planId = (ids) => 'plan-' + createHash('sha256').update(ids.slice().sort().join('\n')).digest('hex').slice(0, 8);

/**
 * Compute the plan for a module's pending staged set: each member's projected diff
 * + a content-addressed id. Writes NOTHING (dry-run). @returns {{module, planId, count, members}}
 */
export function planFor(home, module) {
  const staged = listStaged(home, module);
  const members = staged.map((s) => {
    const current = readNote(home, module, lookupId(s));
    const { target, after, error } = projectChange(s, current);
    return { id: s.id, op: s.op, target, addr: `${module}:${target}`, error, diff: error ? null : diffNote(current, after) };
  });
  return { module, planId: planId(staged.map((s) => s.id)), count: members.length, members };
}

/**
 * Apply a plan transactionally: all members → ONE generation (commit mints once per
 * touched module; a plan is single-module, so exactly one). The plan id is a TOCTOU
 * guard — if the pending set changed since `planFor`, refuse (re-plan). On a mid-batch
 * failure commit reverts the items tree and nothing is archived (a retry is safe).
 * @returns {{ ok, module?, planId?, applied?, generation?, stale?, error?, reverted? }}
 */
export function applyPlan(home, module, expectedId = null) {
  const staged = listStaged(home, module);
  if (!staged.length) return { ok: false, error: 'nothing staged' };
  const actualId = planId(staged.map((s) => s.id));
  if (expectedId && expectedId !== actualId) {
    return { ok: false, stale: true, error: `plan ${expectedId} is stale (now ${actualId}) — re-plan` };
  }
  const res = commit(home, { actor: 'operator' }, staged, {
    label: `apply ${staged.length} change(s) to ${module}`,
    mintedFrom: staged.map((s) => s.id),
  });
  if (!res.ok) return { ok: false, error: res.error, reverted: res.reverted };
  for (const s of staged) archiveStaged(home, module, s.id, 'approved');
  return { ok: true, module, planId: actualId, applied: staged.length, generation: res.generations.find((g) => g.module === module)?.n };
}

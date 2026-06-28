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
// how:  reuse projectChange (preview) + applyChange (write, no mint) + one mint;
//       on any mid-batch failure, revert the items tree to HEAD (git) — notes are
//       pure data, so git restore IS the compensation. Zero-dep.

import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { readNote as readNoteRaw } from '../notes/repo.mjs';
import { listStaged, archiveStaged } from './stage.mjs';
import { applyChange, projectChange } from './evolve.mjs';
import { mint } from '../notes/generation.mjs';
import { git } from '../metal/git.mjs';
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

// revert the module's items to the last committed generation (HEAD) — git IS the
// compensation for note CRUD (pure data, no external side effects). (The append-only
// log may retain entries for the reverted attempt — that's an honest trace, not state.)
// The metal `git()` result is ignored here (best-effort restore), as before.
function revert(home, module) {
  const root = dirname(home);
  git(['checkout', 'HEAD', '--', `.zuzuu/${module}/items`], root);
  git(['clean', '-fdq', '--', `.zuzuu/${module}/items`], root);
}

/**
 * Apply a plan transactionally: all members → ONE generation. The plan id is a
 * TOCTOU guard — if the pending set changed since `planFor`, refuse (re-plan).
 * @returns {{ ok, module?, planId?, applied?, generation?, stale?, error? }}
 */
export function applyPlan(home, module, expectedId = null) {
  const staged = listStaged(home, module);
  if (!staged.length) return { ok: false, error: 'nothing staged' };
  const actualId = planId(staged.map((s) => s.id));
  if (expectedId && expectedId !== actualId) {
    return { ok: false, stale: true, error: `plan ${expectedId} is stale (now ${actualId}) — re-plan` };
  }
  const applied = [];
  for (const s of staged) {
    const r = applyChange(home, module, s);
    if (!r.ok) { revert(home, module); return { ok: false, error: `apply failed on ${s.id}: ${r.error}`, reverted: true }; }
    applied.push(s);
  }
  const gen = mint(home, module, { mintedFrom: applied.map((s) => s.id), label: `apply ${applied.length} change(s) to ${module}` });
  for (const s of applied) archiveStaged(home, module, s.id, 'approved');
  return { ok: true, module, planId: actualId, applied: applied.length, generation: gen.n };
}

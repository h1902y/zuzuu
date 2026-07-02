// src/grow/backfill.mjs — heal legacy notes up to the ENVELOPE FLOOR.
//
// what: `backfillFloor(home, {dryRun})` — for every note missing `title`/`status`,
//       an update op filling them (status → 'active'; title → body first line, else
//       the humanized id), landed as ONE commit: one generation per touched module,
//       every heal provenance-logged with `{backfill: 'envelope-floor'}`.
// why:  the floor guarantee (02-07-2026) lives at the write boundary — new writes
//       always carry it — but history predates it. The backfill brings the corpus
//       into compliance THROUGH the same one door (validated, logged, minted),
//       never by raw file edits. Idempotent: a healed corpus yields an empty worklist.
// how:  pure worklist (floorWorklist) → commit(). Operator-only: the CLI row is
//       `module backfill` (write ∧ ¬agentInvokable → auto-denied to agents by the
//       generated execution gate). It is NOT a `doctor --fix` flag — doctor is a
//       read verb agents may shell; hanging a write behind its flag would punch a
//       hole in the table-derived deny set.

import { listModules } from '../notes/module.mjs';
import { listNoteIds, readNote } from '../notes/repo.mjs';
import { deriveTitle, titleFromId } from '../notes/note.mjs';
import { commit } from './commit.mjs';

const blank = (v) => typeof v !== 'string' || !v.trim();

/** The notes below the floor, as ready-to-commit update ops. Pure read. */
export function floorWorklist(home) {
  const work = [];
  for (const mod of listModules(home)) {
    for (const id of listNoteIds(home, mod.id)) {
      const note = readNote(home, mod.id, id);
      if (!note) continue; // unparseable → zz validate's finding, not the backfill's
      const change = {};
      if (blank(note.status)) change.status = 'active';
      if (blank(note.title)) change.title = deriveTitle(note.body, titleFromId(id));
      if (Object.keys(change).length) {
        work.push({ module: mod.id, op: 'update', target: id, id: `floor-${id}`, change, log: { backfill: 'envelope-floor' } });
      }
    }
  }
  return work;
}

/**
 * Heal the corpus up to the floor. `dryRun` returns the worklist without writing.
 * @returns {{ ok, dryRun, count, modules: Record<string,number>, notes?, generations?, error? }}
 */
export function backfillFloor(home, { dryRun = false, actor = 'operator' } = {}) {
  const work = floorWorklist(home);
  const modules = {};
  for (const w of work) modules[w.module] = (modules[w.module] ?? 0) + 1;
  if (dryRun || !work.length) {
    return { ok: true, dryRun: !!dryRun, count: work.length, modules, notes: work.map((w) => `${w.module}:${w.target}`) };
  }
  const res = commit(home, { actor }, work, { label: 'backfill: envelope floor', mintedFrom: ['backfill:envelope-floor'] });
  if (!res.ok) return res;
  return { ok: true, dryRun: false, count: work.length, modules, generations: res.generations };
}

// src/grow/autonomy.mjs — the wake-source's opt-in switch (KTD4, docs/plans/2026-07-06-
// 001-feat-wake-source-tick-plan.md, U3/U4).
//
// what: ONE note is the founder's auditable "autonomy" switch for this Project —
//       `instructions:autonomy` (`type: autonomy`, field `autonomy_enabled`). Absent
//       note, absent field, or any falsey/un-coercible value all read as OFF. This
//       file is the SINGLE source of truth for that note's exact location + the
//       tolerant boolean read — `grow/tick.mjs` (U3) reads it; the future `zz autonomy
//       on|off` CLI verb (U4) WRITES it (via `grow/edit.mjs`'s `patchNote`, mirroring
//       `grow/trigger.mjs`'s `setTriggerEnabled` exactly) — both against these same
//       three constants, so U4 can never drift from where U3 actually reads.
// why:  R1's fail-closed opt-in (the plan's Requirement 1): "the wake source fires
//       nothing until the founder explicitly enables autonomy for a project." A
//       dedicated note (not a bare flag file) keeps the switch git-native,
//       generation-logged, and visible in `zz query` — the same operator-lane write
//       door every other gated flip in this codebase goes through (never a config
//       file only the CLI can see).
// why a NOTE, not `project.md`: `patchNote` (the write door U4 will use) targets
//       `<home>/<module>/items/<id>.md` via `notes/store.mjs`'s `itemPath` — it has no
//       notion of the root manifest (`project.md` lives at `<home>/project.md`
//       directly, outside any module's `items/`). A dedicated note is patchNote-able
//       today, with zero new write-path plumbing.
// how:  `instructions` is the ONE module `zz init` always seeds (module-templates.mjs),
//       so the note's home exists in every initialized Project even before autonomy is
//       ever turned on — an absent NOTE (not an absent module) is what reads OFF.
//       Zero-dep, fail-soft: a missing/unparseable note or field is `false`, never
//       throws (mirrors `grow/trigger.mjs`'s `isTriggerEnabled` + `notes/validate.mjs`'s
//       `COERCIBLE.bool` tolerance for the exact same "un-coerced CLI string" shape).

import { readNote } from '../notes/repo.mjs';

// The exact, pinned location (U4 must write here, and ONLY here):
export const AUTONOMY_MODULE = 'instructions';
export const AUTONOMY_ID = 'autonomy';
export const AUTONOMY_TYPE = 'autonomy';
export const AUTONOMY_FIELD = 'autonomy_enabled';

// The same tolerant boolean-ish read `isTriggerEnabled`/`COERCIBLE.bool` use — a CLI
// `--field autonomy_enabled=true` staged with no coercion lands as the STRING "true",
// not a real boolean, so this must read past the type, not just `=== true`.
const ENABLED_TRUE = new Set(['true', 'yes', '1']);

/**
 * Read the founder's opt-in switch for THIS Project. `false` (never throws) when the
 * `instructions` module hasn't materialized, the `autonomy` note doesn't exist yet,
 * or `autonomy_enabled` is absent/blank/an unrecognized string — every one of those is
 * the same thing: nobody has explicitly turned this on.
 * @param {string} home
 * @returns {boolean}
 */
export function isAutonomyEnabled(home) {
  let note;
  try { note = readNote(home, AUTONOMY_MODULE, AUTONOMY_ID); } catch { return false; } // an unsafe id can never reach here, but stay total
  if (!note) return false;
  const v = note[AUTONOMY_FIELD];
  if (typeof v === 'boolean') return v;
  return ENABLED_TRUE.has(String(v ?? '').toLowerCase());
}

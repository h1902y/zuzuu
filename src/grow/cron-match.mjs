// src/grow/cron-match.mjs — the zero-dep 5-field cron matcher (the wake source's
// "is this window due?" primitive; U1 of docs/plans/2026-07-06-001-feat-wake-source-
// tick-plan.md).
//
// what: `cronDue(expr, date)` → boolean — does `date` fall inside a 5-field cron
//       expression's minute/hour/day-of-month/month/day-of-week set? Pure, total: a
//       malformed/empty expr (or a bad `date`) returns `false`, never throws.
// why:  `src/` carries ZERO runtime dependencies (src/README.md) — no cron npm
//       library. The tick core (U3) needs the semantic "is this due" answer; SHAPE
//       validation already lives in `notes/validate.mjs` (`CRON_FIELD_RE` /
//       `isParseableCronExpr`) — this file reuses that grammar rather than
//       re-deriving it, and adds only the SEMANTICS on top: which numbers a field's
//       set actually contains, and cron's real day-of-month-OR-day-of-week rule.
// how:  split the (already shape-checked) expr into 5 fields, parse each into a
//       `Set<number>` (`*`, `n`, `a-b`, `a-b/step`, `*/step`, comma lists of those),
//       then test `date`'s local-time fields against each set. Day matching follows
//       cron's own convention: if BOTH dom and dow are restricted (neither field is
//       `*`), the day matches when EITHER set contains it; if only one is
//       restricted, only that one governs; if neither is, the day always matches.

import { isParseableCronExpr } from '../notes/validate.mjs';

// [min, max] per field, in cron's canonical order.
const FIELD_RANGES = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week — 0 = Sunday
];

/** Parse ONE cron field into the Set<number> it selects, given the field's valid
 *  [min,max] (for expanding a bare wildcard or a stepped wildcard). Each
 *  comma-separated part is one of: a bare `*`, a bare `n`, a range `a-b`, a stepped
 *  value `n` + step, a stepped range `a-b` + step, or a stepped wildcard `*` + step —
 *  the same shapes CRON_FIELD_RE accepts. An out-of-range or malformed part is
 *  silently skipped (defensive; shape validation is upstream's job — this never
 *  throws). */
function parseField(field, min, max) {
  const out = new Set();
  for (const part of field.split(',')) {
    const m = /^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/.exec(part);
    if (!m) continue;
    const [, base, rangeEnd, stepStr] = m;
    const step = stepStr ? Number(stepStr) : 1;
    if (!Number.isInteger(step) || step <= 0) continue;
    const lo = base === '*' ? min : Number(base);
    // no range given: a bare `n` selects just n; `n/step` (or `*`/`*/step`) runs to max.
    const hi = rangeEnd !== undefined ? Number(rangeEnd) : (base === '*' || stepStr ? max : lo);
    if (lo < min || hi > max || lo > hi) continue;
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

/**
 * Is `date` inside the 5-field cron expression `expr`'s window? Uses `date`'s LOCAL
 * time (`getMinutes`/`getHours`/`getDate`/`getMonth`+1/`getDay`). Total: any
 * malformed/empty `expr` or invalid `date` → `false`, never throws.
 */
export function cronDue(expr, date) {
  try {
    if (!isParseableCronExpr(expr) || !(date instanceof Date) || Number.isNaN(date.getTime())) {
      return false;
    }
    const fields = expr.trim().split(/\s+/);
    const sets = fields.map((f, i) => parseField(f, FIELD_RANGES[i][0], FIELD_RANGES[i][1]));
    const [minute, hour, dom, month, dow] = sets;

    if (!minute.has(date.getMinutes())) return false;
    if (!hour.has(date.getHours())) return false;
    if (!month.has(date.getMonth() + 1)) return false;

    const domRestricted = fields[2] !== '*';
    const dowRestricted = fields[4] !== '*';
    const domMatch = dom.has(date.getDate());
    const dowMatch = dow.has(date.getDay());

    if (domRestricted && dowRestricted) return domMatch || dowMatch;
    if (domRestricted) return domMatch;
    if (dowRestricted) return dowMatch;
    return true; // neither day field is restricted
  } catch {
    return false; // total: never throw (defensive floor, per this file's header)
  }
}

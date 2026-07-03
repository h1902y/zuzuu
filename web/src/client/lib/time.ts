// lib/time.ts — the one relative-time ladder every activity-timestamp surface
// shares (Projects Home · module generation lineage · note history, §G). Was
// duplicated per-feature (projects-model.ts owned the only copy; §G's history/
// lineage strips would have been a second/third hand-rolled ladder) — pulled up
// so "just now / Nm ago / Nh ago / Nd ago / Nmo ago" lives in exactly one place.
// Pure, `nowMs` injected → tested without faking the clock.

/** A compact relative-activity label from an epoch-ms timestamp. 0/falsy → "—". */
export function relativeTime(ms: number, nowMs: number): string {
  if (!ms) return "—";
  const delta = Math.max(0, nowMs - ms);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Same ladder, fed an ISO timestamp that may be ABSENT or unparsable. Most of the
 *  substrate's mutation timestamps are honestly null today (a module's log.jsonl
 *  carries `ts: null` until a producer stamps one — see src/notes/log.mjs; nothing
 *  in commit.mjs's write path sets it yet) — this returns `fallback` rather than
 *  inventing "just now" from a missing value (the vault's own doctrine: empty is an
 *  honest signal, never papered over). */
export function relativeTimeFromIso(iso: string | null | undefined, nowMs: number, fallback = "—"): string {
  if (!iso) return fallback;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? relativeTime(ms, nowMs) : fallback;
}

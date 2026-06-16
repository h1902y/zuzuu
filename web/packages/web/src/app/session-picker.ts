// Pure, DOM-free logic for the slim session picker (T3).
//
// The single-focus center is built on "a session is a tree". The picker is the
// one switcher: it lists captured sessions ordered active/now → recent → older,
// and resolves whether each is LIVE (a workbench PTY is attached, via the U4
// ptyId join key) or PAST (static, rendered from its trace). Selecting a row
// sets which session the center renders as a SessionTree.
//
// React/fetch-free so the ordering + live/past resolution are unit-tested.
import type { ZuzuuSessionEntry } from "@zuzuu-web/protocol";

/** Recency band for a session row's grouping in the picker. */
export type PickerBand = "now" | "recent" | "older";

/** A session as the picker sees it: the trace entry + whether a live PTY tab is
 *  attached (so the center streams the terminal + a growing tree) and which band
 *  it sorts into. */
export interface PickerRow {
  session: ZuzuuSessionEntry;
  /** a workbench PTY tab is alive for this trace session (U4 ptyId join) */
  live: boolean;
  band: PickerBand;
}

/** The set of live PTY tab ids the picker can join against. */
export interface LiveTab {
  id: string;
  type: string;
  alive: boolean;
}

const LIVE_STATES = new Set(["active", "opening"]);

const epoch = (iso: string | null | undefined): number => {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Is this trace session LIVE in the workbench? True when its U4 ptyId joins an
 * alive PTY tab. Pre-U4 records (no ptyId) fall back to the single-alive-agent
 * guess only when the session itself is in a live state — never inventing a live
 * link for a clearly-past session.
 */
export function isLive(session: ZuzuuSessionEntry, tabs: LiveTab[]): boolean {
  if (session.ptyId) {
    return tabs.some((t) => t.id === session.ptyId && t.alive);
  }
  // pre-U4 fallback: a live-state session + a lone alive agent tab
  if (!LIVE_STATES.has(String(session.state))) return false;
  return tabs.some((t) => t.type === "agent" && t.alive);
}

/** Which recency band a session sorts into. Live/active → "now"; otherwise by
 *  age of its start time (< 24h → recent, else older). */
export function bandFor(session: ZuzuuSessionEntry, live: boolean, now: number = Date.now()): PickerBand {
  if (live || LIVE_STATES.has(String(session.state))) return "now";
  const age = now - epoch(session.startedAt);
  if (age >= 0 && age < 86_400_000) return "recent";
  return "older";
}

const BAND_RANK: Record<PickerBand, number> = { now: 0, recent: 1, older: 2 };

/**
 * Build the picker's ordered rows: active/now first, then recent, then older;
 * within a band, newest start time first. Each row carries its resolved
 * live/past state so the center knows to stream (live) or render statically
 * (past). Stable: a tie on start time keeps input order.
 */
export function pickerRows(
  sessions: ZuzuuSessionEntry[],
  tabs: LiveTab[],
  now: number = Date.now(),
): PickerRow[] {
  const rows = sessions.map((session) => {
    const live = isLive(session, tabs);
    return { session, live, band: bandFor(session, live, now) };
  });
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const byBand = BAND_RANK[a.r.band] - BAND_RANK[b.r.band];
      if (byBand !== 0) return byBand;
      const byTime = epoch(b.r.session.startedAt) - epoch(a.r.session.startedAt);
      if (byTime !== 0) return byTime;
      return a.i - b.i; // stable
    })
    .map(({ r }) => r);
}

/**
 * Resolve which session the center should view, given the picker rows and the
 * user's explicit selection. An explicit pick wins (when still present); else
 * the first row (the most-relevant: a live/now session, or the newest past
 * one). Null only when there are no sessions at all.
 */
export function resolveViewed(rows: PickerRow[], selectedId: string | null): PickerRow | null {
  if (rows.length === 0) return null;
  if (selectedId) {
    const hit = rows.find((r) => r.session.id === selectedId);
    if (hit) return hit;
  }
  return rows[0] ?? null;
}

/**
 * Filter picker rows by a free-text query (case-insensitive substring over the
 * session's host, state, git branch, and id). A blank query returns all rows.
 * Pure so the picker's search box is unit-tested without the DOM.
 */
export function filterPickerRows(rows: PickerRow[], query: string): PickerRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    const s = r.session;
    const hay = [s.host, s.state, s.git?.branch, s.id].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
}

/** A collapsed-summary description for the session picker header. */
export interface PickerSummary {
  /** Label for the primary (viewed) session — e.g. "claude-code" or "session". */
  label: string;
  /** Total session count. */
  total: number;
  /** Human-readable count string — "1 session" or "4 sessions". */
  countLabel: string;
}

/**
 * Build the collapsed summary for the session picker:
 * the viewed session's host label + a count of all sessions.
 */
export function pickerCollapsedSummary(rows: PickerRow[], viewed: PickerRow | null): PickerSummary {
  const total = rows.length;
  const countLabel = total === 1 ? "1 session" : `${total} sessions`;
  const label = viewed
    ? (viewed.session.host ?? "session")
    : "session";
  return { label, total, countLabel };
}

/**
 * Group picker rows by band, preserving the within-band order from pickerRows().
 */
export function groupRowsByBand(rows: PickerRow[]): Map<PickerBand, PickerRow[]> {
  const groups = new Map<PickerBand, PickerRow[]>([
    ["now", []],
    ["recent", []],
    ["older", []],
  ]);
  for (const row of rows) {
    groups.get(row.band)!.push(row);
  }
  return groups;
}

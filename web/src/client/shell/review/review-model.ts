// shell/review/review-model.ts — the cross-session review queue logic (U7; the .tsx
// queue + ProposalCard render it). Aggregate staged changes across all modules into
// ONE queue, group by module (or session, U6), and gate rejects behind a reason chip
// (the gate that teaches). Pure + tested.
import type { StagedSummary } from "#shared/index.js";
import { attentionScore } from "./score.js";
import { provenanceOf } from "./provenance.js";

/** The reason taxonomy — each maps to a loop adjustment downstream. */
export const REJECT_REASONS = ["duplicate", "wrong", "scope", "granular", "premature", "reword"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** A staged proposal carrying its computed attention score (U4: confidence ×
 *  blast-radius, see score.ts). The item shape every queue consumer downstream of
 *  scoring works with. */
export interface ScoredStaged extends StagedSummary {
  /** attentionScore(item) — HIGHER = needs more scrutiny. Display + sort only. */
  score: number;
}

/** Flatten per-module staged maps into one cross-session queue. */
export function aggregateStaged(byModule: Record<string, StagedSummary[]>): StagedSummary[] {
  return Object.values(byModule).flat();
}

/** Attach each proposal's attention score (U4) — pure, before sort. */
export function scoreQueue(items: StagedSummary[]): ScoredStaged[] {
  return items.map((it) => ({ ...it, score: attentionScore(it) }));
}

/** Sort a scored queue by attention, HIGHEST (needs-most-scrutiny) first — the
 *  destructive/low-confidence float to the top, safe/high-confidence collapse toward
 *  the tail. Stable: equal scores preserve first-seen order (`Array.sort` is a stable
 *  sort per spec), so this only REORDERS by score, it doesn't otherwise reshuffle. */
export function sortByScore<T extends { score: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.score - a.score);
}

/** Group the queue by a key (e.g. module). Stable: groups in first-seen order. */
export function groupBy<T, K extends keyof T>(items: T[], key: K): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const it of items) {
    const k = String(it[key] ?? "—");
    (out[k] ??= []).push(it);
  }
  return out;
}

// ── U6 — the session/run grouping axis ──────────────────────────────────────────
//
// The bucket a "review everything from last night's run" motion needs: not the
// target module, but the session(s) that BIRTHED the proposal (provenance.ts's
// "Born from N sessions" line already carries this — it was just never used as a
// grouping key). `provenanceOf`'s `sessions` list is first-seen/append order (see
// its header) — read as chronological corroboration order, so the LAST entry is
// the MOST-RECENT originating session. A proposal "born from N sessions" (the
// multi-session case) is bucketed under that last one: "last night's run" means
// the run that most recently touched it, not the run that first noticed it.

/** The stable bucket for a proposal with no resolvable provenance (hand-staged, or
 *  a producer that omits `source`) — never silently dropped from the session view. */
export const NO_SESSION_BUCKET = "no-session";

/** The session/run bucket key for one item: its MOST-RECENT origin session (the
 *  last id in provenanceOf's session list — see the header above for why "most
 *  recent" means "last-in-list"), or `NO_SESSION_BUCKET` when the item carries no
 *  resolvable provenance at all. Pure projection — never mutates `item`. */
export function sessionKeyOf(item: Pick<StagedSummary, "source">): string {
  const prov = provenanceOf(item.source);
  if (!prov || !prov.sessions.length) return NO_SESSION_BUCKET;
  return prov.sessions[prov.sessions.length - 1]!;
}

/** The two grouping axes the queue can be viewed by (U6's toggle). */
export type GroupAxis = "module" | "session";

/** Group an (already scored + sorted) queue along either axis. Built on plain
 *  `Array` iteration — it never reorders `items`, only partitions them — so a
 *  score-sorted input (use-review-queue.ts's `sortByScore`) yields score-sorted
 *  buckets on EITHER axis: U4's within-group ordering survives the axis switch.
 *  Because this is a pure re-partition of the SAME `items` array, calling it twice
 *  with a different `axis` over the identical queue is how the toggle regroups
 *  without a refetch (ReviewQueue.tsx never re-fetches on axis change). */
export function groupByAxis<T extends Pick<StagedSummary, "source" | "module">>(
  items: T[],
  axis: GroupAxis,
): Record<string, T[]> {
  if (axis === "session") {
    const out: Record<string, T[]> = {};
    for (const it of items) {
      const k = sessionKeyOf(it);
      (out[k] ??= []).push(it);
    }
    return out;
  }
  return groupBy(items, "module");
}

/** The calm "all caught up" state (R5). */
export const isCaughtUp = (queue: StagedSummary[]): boolean => queue.length === 0;

/** A reject must carry a reason from the taxonomy (the gate that teaches). */
export function validReject(reason: string): reason is RejectReason {
  return (REJECT_REASONS as readonly string[]).includes(reason);
}

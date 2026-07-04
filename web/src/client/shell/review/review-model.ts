// shell/review/review-model.ts — the cross-session review queue logic (U7; the .tsx
// queue + ProposalCard render it). Aggregate staged changes across all modules into
// ONE queue, group by module (or session), and gate rejects behind a reason chip
// (the gate that teaches). Pure + tested.
import type { StagedSummary } from "#shared/index.js";
import { attentionScore } from "./score.js";

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

/** The calm "all caught up" state (R5). */
export const isCaughtUp = (queue: StagedSummary[]): boolean => queue.length === 0;

/** A reject must carry a reason from the taxonomy (the gate that teaches). */
export function validReject(reason: string): reason is RejectReason {
  return (REJECT_REASONS as readonly string[]).includes(reason);
}

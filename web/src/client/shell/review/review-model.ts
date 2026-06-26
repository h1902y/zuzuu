// shell/review/review-model.ts — the cross-session review queue logic (U7; the .tsx
// queue + ProposalCard render it). Aggregate staged changes across all modules into
// ONE queue, group by module (or session), and gate rejects behind a reason chip
// (the gate that teaches). Pure + tested.
import type { StagedSummary } from "#shared/index.js";

/** The reason taxonomy — each maps to a loop adjustment downstream. */
export const REJECT_REASONS = ["duplicate", "wrong", "scope", "granular", "premature", "reword"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** Flatten per-module staged maps into one cross-session queue. */
export function aggregateStaged(byModule: Record<string, StagedSummary[]>): StagedSummary[] {
  return Object.values(byModule).flat();
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

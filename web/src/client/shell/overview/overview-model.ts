// shell/overview/overview-model.ts — the pure model behind the Project home (U6).
// Derives the brain-health summary from the module overview + the last-activity
// timestamp. (The session-card ordering was dropped with the Overview's SESSIONS column
// — U6.) Pure → tested; the .tsx only renders.
import type { ModuleOverviewEntry, SessionInfo } from "#shared/index.js";

export interface BrainSummary {
  /** module count (the "tables"). */
  tables: number;
  /** total notes across all modules (Σ items). */
  notes: number;
  /** total pending proposals awaiting review (Σ pending). */
  pending: number;
  /** integrity issues (Σ module errors — broken links · orphans · stale). The brain-
   *  trust signal the home keeps VISIBLE (PL-4 / origin §4.2 guardrail), not wallpaper. */
  integrity: number;
}

/** Roll the module overview into the Overview's health row. */
export function brainSummary(modules: ModuleOverviewEntry[]): BrainSummary {
  return modules.reduce<BrainSummary>(
    (acc, m) => ({
      tables: acc.tables + 1,
      notes: acc.notes + (m.counts?.items ?? 0),
      pending: acc.pending + (m.counts?.pending ?? 0),
      integrity: acc.integrity + (m.counts?.errors ?? 0),
    }),
    { tables: 0, notes: 0, pending: 0, integrity: 0 },
  );
}

/** The newest session timestamp (ms), 0 when there are none — the "last activity"
 *  the identity row shows when the brain has no mtime of its own. */
export function lastSessionActivity(sessions: SessionInfo[]): number {
  return sessions.reduce((max, s) => Math.max(max, s.createdAt), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// The "what needs me" home model (§4.2). Pure — the .tsx renders it.

/** Which shape the home takes. `needs-me` = the COMPOSITE of pending brain proposals
 *  AND sessions held at the merge gate (matches shouldFireCloseCard — a merge decision
 *  needs the user too); `first` = a fresh project (no sessions, nothing pending),
 *  intentionally calm; `steady` = has sessions, nothing needs the user; `setup` =
 *  onboarding in progress — an ADDITIVE companion, so the home keeps its chrome and only
 *  suppresses the review-hero (never a separate screen). */
export type HomeLead = "setup" | "needs-me" | "first" | "steady";

export interface HomeModel {
  lead: HomeLead;
  /** composite: pending proposals + held sessions awaiting merge. */
  needsMeCount: number;
  pendingCount: number;
  heldCount: number;
  /** the review action is shown + prominent — dual-primary ALONGSIDE Start-a-session,
   *  never a hard flip to a review-only chore-list (PL-2). */
  showReview: boolean;
  /** the state-accurate headline (empty for setup — the companion owns that copy). */
  copy: string;
}

export function homeModel(input: {
  pendingCount: number;
  heldCount: number;
  sessionCount: number;
  setupIncomplete: boolean;
}): HomeModel {
  const { pendingCount, heldCount, sessionCount, setupIncomplete } = input;
  const needsMeCount = pendingCount + heldCount;
  const lead: HomeLead = setupIncomplete
    ? "setup"
    : needsMeCount > 0
      ? "needs-me"
      : sessionCount === 0
        ? "first"
        : "steady";
  return {
    lead,
    needsMeCount,
    pendingCount,
    heldCount,
    showReview: lead === "needs-me", // false during setup even if pending > 0 (R6: suppress the hero while onboarding)
    copy:
      lead === "needs-me" ? needsMeCopy(pendingCount, heldCount)
      : lead === "first" ? "You're set up — start your first session."
      : lead === "steady" ? "All caught up."
      : "",
  };
}

/** Name BOTH review classes so the home is honest about what needs the user. */
export function needsMeCopy(pending: number, held: number): string {
  const parts: string[] = [];
  if (pending > 0) parts.push(`${pending} proposal${pending === 1 ? "" : "s"} to review`);
  if (held > 0) parts.push(`${held} session${held === 1 ? "" : "s"} awaiting merge`);
  return `${parts.join(" · ")} — waiting for you`;
}

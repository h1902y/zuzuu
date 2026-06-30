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
}

/** Roll the module overview into the Overview's health row. */
export function brainSummary(modules: ModuleOverviewEntry[]): BrainSummary {
  return modules.reduce<BrainSummary>(
    (acc, m) => ({
      tables: acc.tables + 1,
      notes: acc.notes + (m.counts?.items ?? 0),
      pending: acc.pending + (m.counts?.pending ?? 0),
    }),
    { tables: 0, notes: 0, pending: 0 },
  );
}

/** The newest session timestamp (ms), 0 when there are none — the "last activity"
 *  the identity row shows when the brain has no mtime of its own. */
export function lastSessionActivity(sessions: SessionInfo[]): number {
  return sessions.reduce((max, s) => Math.max(max, s.createdAt), 0);
}

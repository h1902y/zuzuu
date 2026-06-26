// shell/overview/overview-model.ts — the pure model behind the Project Overview (the
// balanced home base, P1.5). Derives the health summary from the module overview and
// orders the session cards (live first, then most-recent). Pure → tested; the .tsx
// only renders.
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

export interface SessionCard {
  id: string;
  title: string;
  live: boolean;
  createdAt: number;
  type: SessionInfo["type"];
}

/** Order the session cards for the SESSIONS column: live sessions first, then by
 *  most-recent. A stable copy — never mutates the source list. */
export function sessionCards(sessions: SessionInfo[]): SessionCard[] {
  return sessions
    .map((s) => ({ id: s.id, title: s.title, live: s.alive, createdAt: s.createdAt, type: s.type }))
    .sort((a, b) => Number(b.live) - Number(a.live) || b.createdAt - a.createdAt);
}

/** The newest session timestamp (ms), 0 when there are none — the "last activity"
 *  the identity row shows when the brain has no mtime of its own. */
export function lastSessionActivity(sessions: SessionInfo[]): number {
  return sessions.reduce((max, s) => Math.max(max, s.createdAt), 0);
}

// W2a: the deterministic outcome card — fold a session's own counts (turns /
// tools / errors / duration, from the capture index) together with its resolved
// diff totals ("what changed", from useSessionDiffQuery) into ONE flat shape.
// Pure; read-only. A null diff (unavailable / unresolved) zeroes the file deltas
// but keeps the session counts — the card still reports the run's shape.
import type { ZuzuuSessionEntry } from "@zuzuu-web/protocol";

export interface SessionOutcome {
  files: number;
  additions: number;
  deletions: number;
  turns: number;
  tools: number;
  errors: number;
  durationMs: number | null;
}

type DiffTotals = { files: number; additions: number; deletions: number } | null | undefined;

export function summarizeOutcome(session: ZuzuuSessionEntry, diffTotals: DiffTotals): SessionOutcome {
  const c = session.counts;
  return {
    files: diffTotals?.files ?? 0,
    additions: diffTotals?.additions ?? 0,
    deletions: diffTotals?.deletions ?? 0,
    turns: c?.turns ?? 0,
    tools: c?.tools ?? 0,
    errors: c?.errors ?? 0,
    durationMs: session.durationMs ?? null,
  };
}

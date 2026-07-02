// note/note-history-model.ts — the pure model behind the History group (§G.1):
// a note's mutation-log entries (log.jsonl, via the /history route), how each
// bucket-sorts by actor, and the one-line "what happened" summary a row renders.
// Pure → tested; NoteDocument.tsx only renders.
import type { HistoryEntry } from "#shared/index.js";

/** The substrate's named actor buckets (§G's teach-the-substrate vocabulary):
 *  human · agent · migration · ingestion. `agent` never lands in practice today
 *  (the moat refuses a non-operator commit — writes an agent proposes only land
 *  once a human approves, which stamps `human`); migration/ingestion are
 *  designed-but-unwired (§I.2). Anything else a producer stamps (e.g. `init`'s
 *  seed writes) buckets to "other" — the raw string still rides through for the
 *  tooltip, never silently relabeled. */
export type ActorBucket = "human" | "agent" | "migration" | "ingestion" | "other";

const KNOWN_ACTORS = new Set<string>(["human", "agent", "migration", "ingestion"]);

export function actorBucket(actor: string | undefined): ActorBucket {
  return actor && KNOWN_ACTORS.has(actor) ? (actor as ActorBucket) : "other";
}

/** The envelope keys a row's summary NEVER repeats — they already have their own
 *  column (event/op glyph, actor glyph, the timestamp). Every other key on the
 *  entry is a breadcrumb worth surfacing (proposal id, backfill marker, rename/
 *  merge/refactor/rollback provenance, relation type, …). */
const OWNED = new Set(["event", "ts", "note", "actor"]);

/** A short "why/what" fragment from an entry's extras — the first non-owned key,
 *  rendered `key: value` (a proposal id, a backfill marker, …). Absent when the
 *  entry carries nothing beyond the four owned fields (a bare create/update). */
export function historyExtra(entry: HistoryEntry): string | null {
  for (const [k, v] of Object.entries(entry)) {
    if (OWNED.has(k) || v == null || v === "") continue;
    return `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`;
  }
  return null;
}

/** The row's op label — the raw event name is already the right word
 *  (create/update/delete/deprecate); kept as a function so a future synonym
 *  (e.g. a rename surfacing as "renamed") has one place to land. */
export const historyOpLabel = (entry: HistoryEntry): string => entry.event;

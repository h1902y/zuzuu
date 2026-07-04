// shell/review/proposal-title.ts — a proposal's DISPLAY TITLE, derived from its op +
// target, NEVER the raw stg-… id. The identity row's single scariest failure mode
// (seen live): a critical DELETE/DEPRECATE/UPDATE proposal rendering the opaque
// staged id (`stg-53ea6bc7`) as its title, with no indication of what it affects. A
// create's title already carries the note's real name (the server's `stagedTitle` in
// zuzuu-peek.ts resolves it from the staged change's own title/body/rationale) — but
// update/delete/deprecate all TARGET an existing note rather than carrying one, and
// that same server-side fallback chain degrades all the way to the id when the
// staged change is sparse (a delete/deprecate carries little more than the target).
//
// This fixes it at the TARGET, not the id: the title always names WHAT's affected,
// prettified from the target id, upgraded to the note's own title when the caller
// has it resolved (e.g. DiffPreview's/NoteDocument's already-fetched target note) — a
// dangling target (nothing resolved) still falls back to the id, never the stg-….
// Pure → tested (proposal-title.test.ts). Reused verbatim by ProposalCard.tsx (the
// review queue) and NoteDocument.tsx (U8's inline accept) — one source of truth, not
// two dialects.
import type { StagedSummary } from "#shared/index.js";

/** The minimal shape of a resolved target note this module needs — a subset of
 *  ModuleItem, kept local so this file has no dependency beyond #shared. */
export interface TargetNoteLike {
  title?: string;
  body?: string;
}

/** A kebab/snake-case note id, prettified into a human-readable label:
 *  "kickoff-call-with-acme" → "Kickoff call with acme". A pure text transform, never
 *  a lookup — the fallback for a target whose note isn't (yet) resolved. */
export function prettifyId(id: string): string {
  const spaced = id.replace(/[-_]+/g, " ").trim();
  if (!spaced) return id;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The op-specific verb a title leads with — the scariest word in the sentence for a
 *  delete/deprecate, so it comes first. `update` (and any unrecognized/absent op that
 *  still carries a target) has no verb: the target's name alone is the heading, the
 *  field diff below already says WHAT changed. */
const OP_VERB: Record<string, string> = {
  delete: "Delete",
  deprecate: "Deprecate",
  relate: "Relate",
  unrelate: "Unrelate",
};

/** The target's human-readable label — the note's own title when the caller has it
 *  resolved (`targetNote`, e.g. an already-fetched ModuleItem), else the target id
 *  prettified. `null` only when the proposal carries no target at all (a create).
 *  NEVER the raw stg-… id — a dangling target (the note no longer resolves in the
 *  store) still renders its own id, prettified, not the staged id. */
export function proposalTargetLabel(
  item: Pick<StagedSummary, "target">,
  targetNote?: TargetNoteLike | null,
): string | null {
  const target = item.target;
  if (!target) return null;
  if (targetNote?.title) return targetNote.title;
  return prettifyId(target);
}

/** A proposal's DISPLAY TITLE — the single source both surfaces (ProposalCard's
 *  identity row, NoteDocument's inline U8 card) render as their heading:
 *   - create (no target) → the staged change's own name; `item.title` already
 *     resolves this server-side (stagedTitle prefers the change's own title/body) —
 *     kept verbatim, this is the case that already worked.
 *   - update → the target's human name alone (never `item.title`, which the server
 *     may degrade to the staged id for a sparse change) — the field diff below
 *     already says WHAT changed, the heading only needs to say to WHOM.
 *   - delete / deprecate (/ relate / unrelate) → "<Verb> <target-name>" — the op
 *     leads because it's the scariest part of the sentence.
 *  Never falls through to `item.id` (the stg-… id). */
export function proposalTitle(
  item: Pick<StagedSummary, "id" | "title" | "op" | "target">,
  targetNote?: TargetNoteLike | null,
): string {
  const label = proposalTargetLabel(item, targetNote);
  if (!label) return item.title;
  const verb = item.op ? OP_VERB[item.op] : undefined;
  return verb ? `${verb} ${label}` : label;
}

/** A short one-line preview of the target note's body — the "small preview" a
 *  delete/deprecate surfaces alongside its title, so the user sees what's actually
 *  being removed, not just its name. The first non-blank line, truncated; undefined
 *  when there's nothing to show (no note resolved, or an empty body) — never
 *  invented. */
export function targetPreview(targetNote: TargetNoteLike | null | undefined, max = 140): string | undefined {
  const body = targetNote?.body;
  if (!body) return undefined;
  const line = body.split("\n").find((l) => l.trim().length > 0)?.trim();
  if (!line) return undefined;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

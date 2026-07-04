// shell/stage/view-board-model.ts — U2 (live-views plan, docs/plans/2026-07-04-002)
// pure core: derive the ViewBoard's fetch scope, its header's human query-summary,
// and its empty/error decision, all from a `type:view` note. `ViewBoard.tsx` stays
// thin (`web/CLAUDE.md` logic-in-.ts) — every branch below is a plain function so
// it can be tested without a DOM/render harness (this suite has none).
//
// The one load-bearing delegation: fetch scope + groupBy come straight from U1's
// `viewQueryToListState` (view-query.ts) — this module never re-derives that
// mapping, only wraps it with the note-shaped input ViewBoard.tsx actually has,
// and adds the two things U1 doesn't own: the header copy and the R5 classifier.
import { viewQueryToListState, type ResolvedViewQuery } from "./view-query.js";
import type { ListState } from "../../data/list-state.js";
import { clauseParts } from "./table-model.js";

/** The bit of a `type:view` note this module actually reads — deliberately not
 *  `ModuleItem` itself (ViewBoard.tsx's own note type extends it): keeps this
 *  module honest about its real dependency, and testable with bare literals. */
export interface ViewNoteLike {
  query?: unknown;
}

/** A plain, non-array, non-null object — the ONE shape a `query` map can
 *  usefully be. Mirrors view-query.ts's own (private) `asQueryRecord` guard so
 *  "deliberately empty" (`{}`, a real, valid, unfiltered view) and "not a query
 *  at all" (a string/number/array/`null`/absent) read as different things here,
 *  even though U1's mapper coerces both to the same safe ListState. */
function isQueryRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v);
}

/** U2's fetch-scope derivation (R1/R2/R8): a view note's `query` → the ListState
 *  the SAME list provider Everything/Grid use can fetch (module scope + filter +
 *  sort + groupBy) — entirely delegated to U1. `note` may be absent (the getOne
 *  fetch hasn't resolved, or 404'd) — `viewQueryToListState` is total, so this
 *  never throws; the caller's classifier decides what an unusable note MEANS. */
export function viewFetchState(note: ViewNoteLike | null | undefined, moduleFallback: string): ResolvedViewQuery {
  return viewQueryToListState(note?.query, moduleFallback);
}

/** `!=`/`>=`/`<=` read as their math glyphs in the header line; `=`/`>`/`<` are
 *  already their own glyph (table-model's OPS is the source list). */
const OP_GLYPH: Record<string, string> = { "!=": "≠", ">=": "≥", "<=": "≤" };

/** A where clause ("stage!=lost") → its human reading ("stage ≠ lost"). Falls
 *  back to the raw clause verbatim if it doesn't parse as key/op/value (honest,
 *  never a fabricated summary of a clause it doesn't understand). */
function prettyClause(clause: string): string {
  const { key, op, value } = clauseParts(clause);
  return op ? `${key} ${OP_GLYPH[op] ?? op} ${value}` : clause;
}

/** The board header's human summary of the running query (U2's "grouped by
 *  stage · where stage ≠ lost" line). Fixed axis order (group → type → status →
 *  filters → text → sort) so the same query always reads the same way; a query
 *  with no axes at all (a deliberate, unfiltered view) gets the bare fallback
 *  line rather than an empty string. */
export function viewQuerySummary(state: Pick<ListState, "groupBy" | "kind" | "status" | "where" | "text" | "sort">): string {
  const parts: string[] = [];
  if (state.groupBy) parts.push(`grouped by ${state.groupBy}`);
  if (state.kind) parts.push(`type ${state.kind}`);
  if (state.status) parts.push(`status ${state.status}`);
  if (state.where.length) parts.push(`where ${state.where.map(prettyClause).join(", ")}`);
  if (state.text) parts.push(`matching "${state.text}"`);
  if (state.sort) parts.push(`sorted by ${state.sort.key} ${state.sort.dir}`);
  return parts.length ? parts.join(" · ") : "all notes, ungrouped";
}

export type ViewBoardStatus = "ok" | "empty" | "missing-module" | "malformed";

/** R5's empty/error decision — never a blank stage or crash. Checked in order:
 *  1. MALFORMED — no note to read (fetch failed/404) or its `query` isn't a
 *     usable shape at all; there's no honest query to run.
 *  2. MISSING-MODULE — the resolved module (the query's own `module`, or the
 *     fallback) isn't one of the project's known modules (renamed/removed).
 *  3. EMPTY — a valid query against a real module that matched nothing.
 *  4. OK — otherwise.
 *  `knownModules: null` means "not loaded yet" — too early to call a module
 *  missing, so that check is skipped (the caller should gate this classifier on
 *  its own loading state; it never guesses). */
export function classifyViewBoard({ note, resolvedModule, knownModules, rows }: {
  note: ViewNoteLike | null | undefined;
  resolvedModule: string;
  knownModules: readonly string[] | null;
  rows: readonly unknown[];
}): ViewBoardStatus {
  if (!note || !isQueryRecord(note.query)) return "malformed";
  if (knownModules && !knownModules.includes(resolvedModule)) return "missing-module";
  if (rows.length === 0) return "empty";
  return "ok";
}

/** The EmptyState copy for every non-"ok" classifier state (R5) — an
 *  explanatory title+hint per failure MODE, never a bare "no rows" dead end. */
export interface ViewBoardCopy { title: string; hint: string }

export function viewBoardCopy(status: Exclude<ViewBoardStatus, "ok">, resolvedModule: string): ViewBoardCopy {
  switch (status) {
    case "empty":
      return { title: "No notes match this view", hint: "Nothing in the current query — widen it, or check back once notes land." };
    case "missing-module":
      return { title: "Module not found", hint: `This view queries "${resolvedModule}", which doesn't exist (renamed or removed?).` };
    case "malformed":
      return { title: "This view's query can't be read", hint: "Its query isn't a usable shape — re-save it from a table's filter/group/sort." };
  }
}

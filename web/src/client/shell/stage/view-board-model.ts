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

/** Whether a resolved fetch state already pins down `type` — either via the
 *  view's own `query.type` (surfaced here as `state.kind`, U1's mapping) or an
 *  explicit `type…` clause the author hand-wrote into `where[]` (e.g.
 *  `type=deal`, `type!=lost-deal`). Either one is the author's own intent —
 *  `excludeViewNotesGuard` below must not override it. */
function hasTypeConstraint(state: Pick<ResolvedViewQuery, "kind" | "where">): boolean {
  return Boolean(state.kind) || state.where.some((clause) => clauseParts(clause).key === "type");
}

/** A board is a projection of a module's DATA, not the `type:view` notes that
 *  define boards over it — without this, a "Pipeline by stage" view
 *  (`{module:deals, where:["stage!=lost"], group-by:stage}`) renders a row for
 *  its OWN view note (grouped under "—", since a view note has no `stage`
 *  field). Appends `type!=view` to the resolved fetch state's `where[]` so
 *  view notes never surface as board rows — UNLESS the view's own query
 *  already constrains `type` (`hasTypeConstraint`), in which case the
 *  author's explicit intent wins and this is a no-op. Pure: takes/returns a
 *  `ResolvedViewQuery`, so it's testable without touching `viewFetchState`'s
 *  own note-shaped input. */
export function excludeViewNotesGuard(state: ResolvedViewQuery): ResolvedViewQuery {
  if (hasTypeConstraint(state)) return state;
  return { ...state, where: [...state.where, "type!=view"] };
}

/** U2's fetch-scope derivation (R1/R2/R8): a view note's `query` → the ListState
 *  the SAME list provider Everything/Grid use can fetch (module scope + filter +
 *  sort + groupBy) — entirely delegated to U1. `note` may be absent (the getOne
 *  fetch hasn't resolved, or 404'd) — `viewQueryToListState` is total, so this
 *  never throws; the caller's classifier decides what an unusable note MEANS.
 *  The result then gets `excludeViewNotesGuard`'s display-scope filter: a
 *  board's rows are the module's data, never its own view definitions. */
export function viewFetchState(note: ViewNoteLike | null | undefined, moduleFallback: string): ResolvedViewQuery {
  return excludeViewNotesGuard(viewQueryToListState(note?.query, moduleFallback));
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

export type ViewBoardStatus = "ok" | "empty" | "malformed";

/** R5's empty/error decision — never a blank stage or crash. Checked in order:
 *  1. MALFORMED — no note to read (fetch failed/404) or its `query` isn't a
 *     usable shape at all; there's no honest query to run.
 *  2. OK — rows are present. Data is there — never claim it's missing, no
 *     matter what module it resolved to.
 *  3. EMPTY — a valid query that matched nothing. This is the ONE honest state
 *     for "nothing to show", whether the module is genuinely empty or was
 *     renamed/removed — there used to be a separate MISSING-MODULE state here,
 *     gated on whether `resolvedModule` appeared in the "grown" modules list
 *     (modules with a `module.md`, from `api.zuzuu.overview()`). That signal is
 *     unreliable: the operator lane (`zz note create`) auto-vivifies a
 *     module's notes without ever minting a `module.md`, so a perfectly
 *     queryable module with real rows (e.g. a fresh `deals` with 8 notes) was
 *     absent from "grown" and got a false "Module not found" BEFORE rows were
 *     even considered — hiding real data behind a wrong classification. Rows
 *     are ground truth; a manifest list is not. */
export function classifyViewBoard({ note, rows }: {
  note: ViewNoteLike | null | undefined;
  rows: readonly unknown[];
}): ViewBoardStatus {
  if (!note || !isQueryRecord(note.query)) return "malformed";
  if (rows.length > 0) return "ok";
  return "empty";
}

/** The EmptyState copy for every non-"ok" classifier state (R5) — an
 *  explanatory title+hint per failure MODE, never a bare "no rows" dead end. */
export interface ViewBoardCopy { title: string; hint: string }

export function viewBoardCopy(status: Exclude<ViewBoardStatus, "ok">, resolvedModule: string): ViewBoardCopy {
  switch (status) {
    case "empty":
      return { title: "No notes match this view", hint: "Nothing in the current query — widen it, or check back once notes land." };
    case "malformed":
      return { title: "This view's query can't be read", hint: "Its query isn't a usable shape — re-save it from a table's filter/group/sort." };
  }
}

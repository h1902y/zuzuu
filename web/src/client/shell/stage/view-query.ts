// shell/stage/view-query.ts — the two pure mappers between a `type:view` note's
// `query` map (docs/guide/Modules-as-Tables.md ~62-85: module · text · type ·
// status · tag · where · group-by · agg · limit) and the table's `ListState`
// (data/list-state.ts). U1 of the live-views plan (docs/plans/2026-07-04-002) —
// the load-bearing seam both the open path (viewQueryToListState → ViewBoard,
// U2) and the save path (listStateToViewQuery → save-as-view, U5) depend on.
//
// Both total: a malformed, empty, or hand-mangled `query` coerces to safe
// ListState defaults rather than throwing — the board's own empty/error state
// (U2's classifier) decides what an unusable query MEANS, this module only
// ever hands back something valid.
//
// `tag`/`agg`/`limit` are CLI-only query axes with no ListState counterpart —
// the plan's field set is text · kind/type · status · where[] · sort ·
// group-by (+ the module scope), so those three ride neither direction here.
import type { ListState, SortState } from "../../data/list-state.js";
import { initialListState } from "../../data/list-state.js";

/** The frontmatter shape of a view note's `query` map, read defensively — every
 *  key may be absent, wrongly typed, or malformed (it's hand-editable YAML). */
export interface ViewQuery {
  module?: string;
  text?: string;
  type?: string;
  status?: string;
  where?: string[];
  sort?: SortState;
  "group-by"?: string;
}

/** viewQueryToListState's return: a full, valid ListState (safe to feed
 *  straight into the reducer/queryOf) plus the resolved module scope — the
 *  query's own `module` key when present, else the caller's fallback scope
 *  (e.g. the module of the table the view was opened from). */
export type ResolvedViewQuery = ListState & { module: string };

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** Only a plain object (not an array, not null) is a candidate `query` map;
 *  anything else (a string, a number, `null`, an array…) reads as `{}`. */
function asQueryRecord(query: unknown): ViewQuery {
  return query && typeof query === "object" && !Array.isArray(query) ? (query as ViewQuery) : {};
}

/** A where-clause list, filtered to strings only — a single non-string entry
 *  (malformed YAML) drops just that entry rather than the whole clause list. */
function asWhere(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** A sort spec, accepted only whole (a partially-shaped sort — e.g. a `dir`
 *  that isn't "asc"/"desc" — has no honest partial coercion, so it's dropped
 *  to `null`, the same "unsorted" default `initialListState` carries). */
function asSort(v: unknown): SortState | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Partial<SortState>;
  return isNonEmptyString(s.key) && (s.dir === "asc" || s.dir === "desc") ? { key: s.key, dir: s.dir } : null;
}

/** The open path (KTD1/U2): a view note's `query` → a ready-to-fetch ListState.
 *  Total — `query` may be `{}`, `null`/`undefined`, or hand-mangled YAML; every
 *  field is read defensively and falls back to `initialListState`'s own
 *  default rather than throwing. `moduleFallback` is the scope to use when the
 *  query itself doesn't name a module. */
export function viewQueryToListState(query: unknown, moduleFallback: string): ResolvedViewQuery {
  const q = asQueryRecord(query);
  return {
    ...initialListState,
    module: isNonEmptyString(q.module) ? q.module : moduleFallback,
    text: isNonEmptyString(q.text) ? q.text : initialListState.text,
    kind: isNonEmptyString(q.type) ? q.type : initialListState.kind,
    status: isNonEmptyString(q.status) ? q.status : initialListState.status,
    where: asWhere(q.where),
    sort: asSort(q.sort),
    groupBy: isNonEmptyString(q["group-by"]) ? q["group-by"] : initialListState.groupBy,
  };
}

/** The save path (KTD4/U5): the table's current ListState → the `query` map to
 *  write into a new `type:view` note. The inverse of viewQueryToListState over
 *  the same field set. Empty/default axes are OMITTED (never written as `""`
 *  / `[]` / `null`) so the landed frontmatter is minimal — a one-level map,
 *  matching the envelope's YAML subset (no key round-trips as a stored no-op). */
export function listStateToViewQuery(state: ListState, module: string): ViewQuery {
  const q: ViewQuery = { module };
  if (state.text) q.text = state.text;
  if (state.kind) q.type = state.kind;
  if (state.status) q.status = state.status;
  if (state.where.length) q.where = state.where;
  if (state.sort) q.sort = state.sort;
  if (state.groupBy) q["group-by"] = state.groupBy;
  return q;
}

// data/list-state.ts — the ListContext's pull-model state (pure; tested). One
// <NotesListProvider> owns filter/sort/pagination; the grid, filter-chips, and the
// record panel CONSUME it (no prop-drilling — React-Admin's ListContext, distilled).
// The reducer + the queryOf() selector are pure logic; the .tsx provider is thin.
//
// Rung 7: the state no longer drives a CLIENT-side filter/sort/slice — it drives the
// SERVER query. queryOf() maps the control state to the index query the daemon runs
// (filter·sort·paginate in SQL); the provider just hands back the page + total.

export interface SortState { key: string; dir: "asc" | "desc" }
/** `where` is the CLI's own clause grammar (`key<op>value` strings — the ONE query
 *  grammar, §H.3.1); the server parses the op and pushes it to the EAV index.
 *  `status` is the lifecycle facet (seed/active/archived/deprecated) — a dedicated
 *  axis like `kind`, not a where clause (the daemon route + buildModuleQueryFlags
 *  already accept `--status`, §H.3.1's facet row). */
/** `groupBy` (§H.3.3/§H.4.3) is a TABLE-local view axis — one group-by at a time,
 *  applied client-side over the loaded page (no server aggregate route exists yet
 *  for `module items`, only the CLI's own `zz query --group-by`); it never rides
 *  queryOf/ListQuery. */
export interface ListState { text: string; kind: string; status: string; where: string[]; sort: SortState | null; groupBy: string | null; page: number; pageSize: number }

export const initialListState: ListState = { text: "", kind: "", status: "", where: [], sort: null, groupBy: null, page: 0, pageSize: 50 };

export type ListAction =
  | { type: "setText"; text: string }
  | { type: "setKind"; kind: string }
  | { type: "setStatus"; status: string }
  | { type: "addWhere"; clause: string }
  | { type: "removeWhere"; clause: string }
  | { type: "setWhere"; where: string[] }
  | { type: "toggleSort"; key: string }
  | { type: "setSort"; key: string; dir: "asc" | "desc" }
  | { type: "setGroupBy"; groupBy: string | null }
  | { type: "setPage"; page: number }
  | { type: "reset" };

export function listReducer(s: ListState, a: ListAction): ListState {
  switch (a.type) {
    case "setText": return { ...s, text: a.text, page: 0 };       // a new filter resets the page
    case "setKind": return { ...s, kind: a.kind, page: 0 };
    case "setStatus": return { ...s, status: a.status, page: 0 };
    case "addWhere": return s.where.includes(a.clause) ? s : { ...s, where: [...s.where, a.clause], page: 0 };
    case "removeWhere": return { ...s, where: s.where.filter((w) => w !== a.clause), page: 0 };
    case "setWhere": return { ...s, where: a.where, page: 0 };
    case "toggleSort": {
      const dir: "asc" | "desc" = s.sort?.key === a.key && s.sort.dir === "asc" ? "desc" : "asc";
      return { ...s, sort: { key: a.key, dir }, page: 0 };
    }
    // the Sort BUILDER sets an explicit field+direction (vs toggleSort's header-click
    // cycle) — the same underlying SortState, a second way to write it (§H.4.3).
    case "setSort": return { ...s, sort: { key: a.key, dir: a.dir }, page: 0 };
    case "setGroupBy": return { ...s, groupBy: a.groupBy };
    case "setPage": return { ...s, page: a.page };
    case "reset": return initialListState;
  }
}

/** The whole server query the DataProvider's getList pushes to the index — the filter
 *  (text/kind/status/where) + sort + the page window. The index does the filter·sort·
 *  paginate in SQL; the client no longer filters/sorts/slices in JS (the limit:10000
 *  fetch is gone). */
export interface ListQuery { text: string; kind: string; status: string; where: string[]; sort: SortState | null; page: number; pageSize: number }
export const queryOf = (s: ListState): ListQuery =>
  ({ text: s.text, kind: s.kind, status: s.status, where: s.where, sort: s.sort, page: s.page, pageSize: s.pageSize });

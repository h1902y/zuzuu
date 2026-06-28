// data/list-state.ts — the ListContext's pull-model state (pure; tested). One
// <NotesListProvider> owns filter/sort/pagination; the grid, filter-chips, and the
// record panel CONSUME it (no prop-drilling — React-Admin's ListContext, distilled).
// The reducer + the queryOf() selector are pure logic; the .tsx provider is thin.
//
// Rung 7: the state no longer drives a CLIENT-side filter/sort/slice — it drives the
// SERVER query. queryOf() maps the control state to the index query the daemon runs
// (filter·sort·paginate in SQL); the provider just hands back the page + total.

export interface SortState { key: string; dir: "asc" | "desc" }
export interface ListState { text: string; kind: string; sort: SortState | null; page: number; pageSize: number }

export const initialListState: ListState = { text: "", kind: "", sort: null, page: 0, pageSize: 50 };

export type ListAction =
  | { type: "setText"; text: string }
  | { type: "setKind"; kind: string }
  | { type: "toggleSort"; key: string }
  | { type: "setPage"; page: number }
  | { type: "reset" };

export function listReducer(s: ListState, a: ListAction): ListState {
  switch (a.type) {
    case "setText": return { ...s, text: a.text, page: 0 };       // a new filter resets the page
    case "setKind": return { ...s, kind: a.kind, page: 0 };
    case "toggleSort": {
      const dir: "asc" | "desc" = s.sort?.key === a.key && s.sort.dir === "asc" ? "desc" : "asc";
      return { ...s, sort: { key: a.key, dir }, page: 0 };
    }
    case "setPage": return { ...s, page: a.page };
    case "reset": return initialListState;
  }
}

/** The whole server query the DataProvider's getList pushes to the index — the filter
 *  (text/kind) + sort + the page window. The index does the filter·sort·paginate in
 *  SQL; the client no longer filters/sorts/slices in JS (the limit:10000 fetch is gone). */
export interface ListQuery { text: string; kind: string; sort: SortState | null; page: number; pageSize: number }
export const queryOf = (s: ListState): ListQuery =>
  ({ text: s.text, kind: s.kind, sort: s.sort, page: s.page, pageSize: s.pageSize });

// data/list-state.ts — the ListContext's pull-model state (pure; tested). One
// <NotesListProvider> owns filter/sort/pagination; the grid, filter-chips, and the
// record panel CONSUME it (no prop-drilling — React-Admin's ListContext, distilled).
// The reducer + the project() window are pure logic; the .tsx provider is thin.
import type { ModuleItem } from "#shared/index.js";

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

/** The text/kind half of the state feeds the DataProvider's getList (which filters);
 *  sort + pagination are applied here over the returned items. */
export const filterOf = (s: ListState): { text?: string; kind?: string } =>
  ({ ...(s.text ? { text: s.text } : {}), ...(s.kind ? { kind: s.kind } : {}) });

/** Sort + paginate the (already filtered) items into the visible window. */
export function project(items: ModuleItem[], s: ListState): { rows: ModuleItem[]; total: number; pages: number } {
  let rows = items;
  if (s.sort) {
    const { key, dir } = s.sort;
    const val = (it: ModuleItem) => String((it as unknown as Record<string, unknown>)[key] ?? "");
    rows = [...rows].sort((a, b) => (dir === "asc" ? val(a).localeCompare(val(b)) : val(b).localeCompare(val(a))));
  }
  const total = rows.length;
  const start = s.page * s.pageSize;
  return { rows: rows.slice(start, start + s.pageSize), total, pages: Math.max(1, Math.ceil(total / s.pageSize)) };
}

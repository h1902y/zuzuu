// state/table-selection.ts — the table's row selection (§H.3.4): "selection is
// CONTEXT, the omnibar is the verb." Lives OUTSIDE the table (no bulk action is
// table chrome, §E doctrine) so the omnibar can read it directly, the same way it
// reads the map's `selected` node. Keyed by full addr (`module:id`) so the
// UNIFIED Everything table's cross-module selection stays coherent; one SCOPE
// active at a time (the table currently on stage) — switching scopes clears it,
// since a stale cross-scope selection acting on the wrong table would be a
// silent footgun. `items` rides along (not just addrs) so bulk verbs that need
// the actual row data (export as CSV) don't require a second fetch.
import { create } from "zustand";
import type { ModuleItem } from "#shared/index.js";

/** The unified Everything table's selection scope — distinct from any real module
 *  id (module ids are slugs; this sentinel can't collide, matching the "__all__"
 *  convention Everything.tsx already uses for its NotesListProvider key). */
export const EVERYTHING_SELECTION_SCOPE = "__everything__";

interface TableSelectionState {
  scope: string;
  ids: ReadonlySet<string>;
  items: ReadonlyMap<string, ModuleItem>;
  toggle: (scope: string, addr: string, row?: ModuleItem) => void;
  clear: () => void;
}

export const useTableSelection = create<TableSelectionState>((set, get) => ({
  scope: "",
  ids: new Set(),
  items: new Map(),
  toggle: (scope, addr, row) => {
    const cur = get();
    const fromSameScope = cur.scope === scope;
    const ids = new Set(fromSameScope ? cur.ids : []);
    const items = new Map(fromSameScope ? cur.items : []);
    if (ids.has(addr)) { ids.delete(addr); items.delete(addr); }
    else { ids.add(addr); if (row) items.set(addr, row); }
    set({ scope, ids, items });
  },
  clear: () => set({ scope: "", ids: new Set(), items: new Map() }),
}));

/** The selection visible to a given scope's table (empty when another scope owns
 *  the live selection — switching tables reads as "nothing selected," not stale rows). */
export const selectionFor = (s: Pick<TableSelectionState, "scope" | "ids">, scope: string): ReadonlySet<string> =>
  s.scope === scope ? s.ids : EMPTY_IDS;

const EMPTY_IDS: ReadonlySet<string> = new Set();

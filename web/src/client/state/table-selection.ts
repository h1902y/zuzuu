// state/table-selection.ts — the table's row selection (§H.3.4): "selection is
// CONTEXT, the omnibar is the verb." Lives OUTSIDE the table (no bulk action is
// table chrome, §E doctrine) so the omnibar can read it directly, the same way it
// reads the map's `selected` node. Keyed by full addr (`module:id`) so the
// UNIFIED Everything table's cross-module selection stays coherent; one SCOPE
// active at a time (the table currently on stage) — switching scopes clears it,
// since a stale cross-scope selection acting on the wrong table would be a
// silent footgun. `items` rides along (not just addrs) so bulk verbs that need
// the actual row data (export as CSV) don't require a second fetch.
import { useEffect } from "react";
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
  /** Clear the live selection ONLY if `scope` is the one that currently owns it
   *  (S2) — a scope-guarded reset, symmetric with `selectionFor`'s read side, so a
   *  caller can never blow away a DIFFERENT scope's selection out from under it. */
  clearIfScope: (scope: string) => void;
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
  clearIfScope: (scope) => {
    if (get().scope === scope) set({ scope: "", ids: new Set(), items: new Map() });
  },
}));

/** The selection visible to a given scope's table (empty when another scope owns
 *  the live selection — switching tables reads as "nothing selected," not stale rows). */
export const selectionFor = (s: Pick<TableSelectionState, "scope" | "ids">, scope: string): ReadonlySet<string> =>
  s.scope === scope ? s.ids : EMPTY_IDS;

const EMPTY_IDS: ReadonlySet<string> = new Set();

/** S2: wire a table's selection to auto-clear whenever the query that determines
 *  its VISIBLE rows changes — filter text/kind/status/where, sort, or page. Without
 *  this, a selection accumulates across filter/page navigation and the omnibar's
 *  Export/Delete verbs would silently act on addrs no longer on screen (the
 *  "blind bulk delete" risk S1 compounds). Cleanup-only: React runs a `useEffect`
 *  cleanup exactly when a dep below changes (leaving the old filter/page/sort combo)
 *  OR the component unmounts (leaving the scope entirely, e.g. switching modules or
 *  the Everything facet remounting the provider) — one mechanism covers BOTH "scope
 *  change" and "filter/page change" (the review's fix, verbatim). `clearIfScope`
 *  keeps it a no-op whenever some OTHER scope currently owns the live selection. */
export function useClearSelectionOnQueryChange(
  scope: string,
  text: string, kind: string, status: string, where: readonly string[],
  sortKey: string | undefined, sortDir: string | undefined, page: number,
): void {
  const clearIfScope = useTableSelection((s) => s.clearIfScope);
  useEffect(() => () => clearIfScope(scope), [scope, text, kind, status, where, sortKey, sortDir, page, clearIfScope]);
}

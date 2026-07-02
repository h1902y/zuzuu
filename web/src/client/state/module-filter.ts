// state/module-filter.ts — the per-module filter, shared across BOTH projections.
//
// The grid's filter (text · kind) is not a grid detail — it's the module's active
// LENS. Lifting it out of the list reducer's lifetime means: toggling Table⇄Map
// keeps the filter; the Map renders it as a spotlight (matching nodes lit,
// the rest dimmed); the chip row above the map explains WHY and clears it.
// `scrollTop` rides along so returning to the table lands where you left it.
import { create } from "zustand";

export interface ModuleFilter {
  text: string;
  kind: string;
  /** where clauses in the CLI's own grammar (`key<op>value`) — §H.3's one grammar.
   *  NOTE: where clauses do NOT mirror into the map spotlight (the graph nodes
   *  don't carry arbitrary props client-side) — text/kind/module do; the chip row
   *  still names them so the state is never invisible. */
  where: string[];
  /** the module FACET — only meaningful on the UNIFIED scope ('' = Everything),
   *  where module is a column: narrowing to one module is a filter, not a nav. */
  module: string;
  scrollTop: number;
}

const EMPTY: ModuleFilter = { text: "", kind: "", where: [], module: "", scrollTop: 0 };

interface ModuleFilterState {
  byModule: Record<string, ModuleFilter>;
  patch: (module: string, patch: Partial<ModuleFilter>) => void;
  clear: (module: string) => void;
}

/** The module's active filter ({text:"",kind:""} until set). */
export const filterOf = (byModule: Record<string, ModuleFilter>, module: string): ModuleFilter =>
  byModule[module] ?? EMPTY;

/** Does the filter actually narrow anything (drives the spotlight + chip row)? */
export const isFiltering = (f: ModuleFilter): boolean =>
  f.text.trim() !== "" || f.kind !== "" || f.module !== "" || f.where.length > 0;

export const useModuleFilter = create<ModuleFilterState>((set, get) => ({
  byModule: {},
  patch: (module, patch) =>
    set((s) => ({ byModule: { ...s.byModule, [module]: { ...filterOf(s.byModule, module), ...patch } } })),
  clear: (module) => {
    const { scrollTop } = filterOf(get().byModule, module);
    set((s) => ({ byModule: { ...s.byModule, [module]: { ...EMPTY, scrollTop } } }));
  },
}));

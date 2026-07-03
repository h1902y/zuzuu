// state/module-view.ts — the module stage's Table⇄Map projection, per module.
//
// ONE continuous space, two projections: the table is the maximum-zoom projection
// of a module island; this store remembers which projection each module is showing.
// Scoped PER MODULE (the C1 rule — a view choice never leaks to the NEXT module —
// kept; return visits also keep their choice). Reachable from the shell (the
// segmented toggle + the `T` shortcut) and the palette (`>table` / `>map`).
import { create } from "zustand";

export type ModuleView = "table" | "graph";

interface ModuleViewState {
  byModule: Record<string, ModuleView>;
  set: (module: string, view: ModuleView) => void;
  toggle: (module: string) => ModuleView;
}

/** The module's current projection — "table" until the user says otherwise. */
export const viewOf = (byModule: Record<string, ModuleView>, module: string): ModuleView =>
  byModule[module] ?? "table";

export const useModuleView = create<ModuleViewState>((set, get) => ({
  byModule: {},
  set: (module, view) => set((s) => ({ byModule: { ...s.byModule, [module]: view } })),
  toggle: (module) => {
    const next: ModuleView = viewOf(get().byModule, module) === "table" ? "graph" : "table";
    get().set(module, next);
    return next;
  },
}));

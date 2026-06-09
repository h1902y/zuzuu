import { create } from "zustand";
import { fsEvents } from "../lib/fs-events";

interface ExplorerState {
  /** workspace-relative paths of expanded dirs ("" = root, always expanded) */
  expanded: Set<string>;
  selected: string | null;
  toggle: (path: string) => void;
  collapseAll: () => void;
  select: (path: string | null) => void;
}

export const useExplorer = create<ExplorerState>((set) => ({
  expanded: new Set<string>(),
  selected: null,

  toggle: (path) =>
    set((s) => {
      const expanded = new Set(s.expanded);
      if (expanded.has(path)) {
        expanded.delete(path);
        fsEvents.unwatch(path);
      } else {
        expanded.add(path);
        fsEvents.watch(path);
      }
      return { expanded };
    }),

  collapseAll: () =>
    set((s) => {
      for (const path of s.expanded) fsEvents.unwatch(path);
      return { expanded: new Set<string>() };
    }),

  select: (path) => set({ selected: path }),
}));

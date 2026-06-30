// shell/world-state.ts — the shell's selection store (replaces state/panel.ts). One
// selected nav node drives the stage + wing (via shell-state.selectActors); null =
// home (the database). No modes — the selection IS the navigation.
import { create } from "zustand";
import type { NavNode } from "./shell-state.js";

interface WorldState {
  selected: NavNode | null;
  /** the previously-selected node — lets a ⌘K-only stage (the search results view, U4)
   *  dismiss back to where the user was, since the SPA has no browser history. */
  prev: NavNode | null;
  paletteOpen: boolean;
  select: (node: NavNode | null) => void;
  setPalette: (open: boolean) => void;
}

export const useWorld = create<WorldState>((set) => ({
  selected: null,
  prev: null,
  paletteOpen: false,
  select: (selected) => set((s) => ({ selected, prev: s.selected })),
  setPalette: (paletteOpen) => set({ paletteOpen }),
}));

// shell/world-state.ts — the shell's selection store (replaces state/panel.ts). One
// selected nav node drives the stage + wing (via shell-state.selectActors); null =
// home (the database). No modes — the selection IS the navigation.
import { create } from "zustand";
import type { NavNode } from "./shell-state.js";

interface WorldState {
  selected: NavNode | null;
  paletteOpen: boolean;
  select: (node: NavNode | null) => void;
  setPalette: (open: boolean) => void;
}

export const useWorld = create<WorldState>((set) => ({
  selected: null,
  paletteOpen: false,
  select: (selected) => set({ selected }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
}));

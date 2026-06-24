// src/client/state/panel.ts — the right-panel + palette state.
//
// The right panel is ONE surface with two modes: FILES (the Monaco editor over
// the open file) and MODULES (the modules dashboard — the Project surface). Opening
// a file switches to files; closing it returns to the modules dashboard.
// The command palette's open flag rides here too (one global hotkey owns it).

import { create } from "zustand";

export type PanelMode = "files" | "modules";

interface PanelState {
  mode: PanelMode;
  /** the file open in the editor (files mode), or null */
  openPath: string | null;
  /** the drilled-in module in the dashboard, or null = the tile grid */
  module: string | null;
  paletteOpen: boolean;

  openFile: (path: string) => void;
  closeFile: () => void;
  showModules: () => void;
  openModule: (key: string | null) => void;
  setPalette: (open: boolean) => void;
}

export const usePanel = create<PanelState>((set) => ({
  mode: "modules",
  openPath: null,
  module: null,
  paletteOpen: false,

  openFile: (path) => set({ mode: "files", openPath: path }),
  closeFile: () => set({ mode: "modules", openPath: null }),
  showModules: () => set({ mode: "modules" }),
  openModule: (key) => set({ mode: "modules", module: key }),
  setPalette: (open) => set({ paletteOpen: open }),
}));

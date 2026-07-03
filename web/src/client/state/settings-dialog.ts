// state/settings-dialog.ts — §D: Settings is a DIALOG, not a screen. Opened from
// the footer's right edge (the quiet affordance) or the palette; the canvas is
// never disturbed. A store (not local state) so both entry points reach it.
import { create } from "zustand";

interface SettingsDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useSettingsDialog = create<SettingsDialogState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

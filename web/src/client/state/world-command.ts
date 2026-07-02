// state/world-command.ts — the palette → World imperative bridge (C3).
//
// The omnibar issues camera commands (fly to a note, focus an island, fit) but
// the World engine mounts/unmounts with the stage. A tiny store holds ONE pending
// command; the mounted World consumes it when its data is ready — so `>fit` works
// from anywhere (the shell shows the map, then the command lands).
import { create } from "zustand";

export type WorldCommand =
  | { kind: "flyTo"; addr: string }
  | { kind: "focusModule"; module: string }
  | { kind: "fit" };

interface WorldCommandState {
  pending: WorldCommand | null;
  request: (c: WorldCommand) => void;
  consume: () => WorldCommand | null;
}

export const useWorldCommand = create<WorldCommandState>((set, get) => ({
  pending: null,
  request: (pending) => set({ pending }),
  consume: () => {
    const c = get().pending;
    if (c) set({ pending: null });
    return c;
  },
}));

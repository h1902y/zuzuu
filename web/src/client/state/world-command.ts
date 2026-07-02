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

/** A glow request (the conversation lighting the map). Kept OUT of the camera
 *  slot so a stream of mentions never clobbers a queued `>fit`/fly-to. Carries
 *  raw mentions (module:id or bare id) — the engine resolves them against its
 *  live node set. `at` lets a mounting World drop stale glows (the conversation
 *  may run while the map is off-stage; lighting it minutes later would confuse). */
export interface GlowRequest {
  mentions: string[];
  at: number;
}

interface WorldCommandState {
  pending: WorldCommand | null;
  glow: GlowRequest | null;
  request: (c: WorldCommand) => void;
  requestGlow: (mentions: string[]) => void;
  consume: () => WorldCommand | null;
  consumeGlow: () => GlowRequest | null;
}

export const useWorldCommand = create<WorldCommandState>((set, get) => ({
  pending: null,
  glow: null,
  request: (pending) => set({ pending }),
  requestGlow: (mentions) => { if (mentions.length) set({ glow: { mentions, at: Date.now() } }); },
  consume: () => {
    const c = get().pending;
    if (c) set({ pending: null });
    return c;
  },
  consumeGlow: () => {
    const g = get().glow;
    if (g) set({ glow: null });
    return g;
  },
}));

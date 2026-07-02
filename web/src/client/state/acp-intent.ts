// state/acp-intent.ts — the palette → ACP conversation hand-off (C3).
//
// `/ask something` in the omnibar routes to the EXISTING ACP drive lane (enhance,
// never reinvent — the lane already runs the real interactive host through the
// guardrails gate). The palette queues ONE prompt here and selects the session;
// AcpView sends it the moment the connection reports ready. take() is
// one-shot, so a re-render can never double-send.
import { create } from "zustand";

interface AcpIntentState {
  prompt: string | null;
  set: (prompt: string) => void;
  take: () => string | null;
}

export const useAcpIntent = create<AcpIntentState>((set, get) => ({
  prompt: null,
  set: (prompt) => set({ prompt }),
  take: () => {
    const p = get().prompt;
    if (p !== null) set({ prompt: null });
    return p;
  },
}));

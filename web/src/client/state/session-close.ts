// state/session-close.ts — the "what this session taught" close-card state (U5/R5).
//
// An agent TermView reports its PTY exit here; the detector hook (use-session-close)
// polls the session detail, and — when the close staged proposals (pending > 0) and
// the session hasn't fired before — opens the card. The store holds only the active
// card + the report queue; the detection/dedup logic is the pure session-close-card.ts.
import { create } from "zustand";
import type { StagedSummary } from "#shared/index.js";

export interface CloseCardData {
  sessionId: string;
  pending: number;
  staged: StagedSummary[];
}

interface SessionCloseState {
  /** agent session ids whose PTY exited and await close-detection (FIFO). */
  reported: string[];
  /** the card currently shown (null when none). */
  card: CloseCardData | null;
  /** an agent TermView calls this on its Exit frame. */
  reportExit: (sessionId: string) => void;
  /** the detector consumed a reported id (poll done). */
  consume: (sessionId: string) => void;
  /** open the card for an ended session. */
  show: (data: CloseCardData) => void;
  /** dismiss the card (does NOT re-fire — the dedup mark persists). */
  dismiss: () => void;
}

export const useSessionClose = create<SessionCloseState>((set) => ({
  reported: [],
  card: null,
  reportExit: (sessionId) =>
    set((s) => (s.reported.includes(sessionId) ? s : { reported: [...s.reported, sessionId] })),
  consume: (sessionId) => set((s) => ({ reported: s.reported.filter((id) => id !== sessionId) })),
  show: (data) => set({ card: data }),
  dismiss: () => set({ card: null }),
}));

/** Report an agent PTY exit from non-React code (the TermView onExit). */
export const reportAgentExit = (sessionId: string): void => useSessionClose.getState().reportExit(sessionId);

// state/session-close.ts — the "what this session taught" close-card state (U5/R5).
//
// An agent TermView reports its PTY exit here; the detector hook (use-session-close)
// polls the session detail, and — when the close staged proposals (pending > 0) and
// the session hasn't fired before — opens the card. The store holds only the active
// card + the report queue; the detection/dedup logic is the pure session-close-card.ts.
import { create } from "zustand";
import {
  cardWithoutCode,
  enqueueCard,
  advanceQueue,
  replaceCurrent,
  type CloseCardData,
} from "../shell/review/session-close-card.js";

export type { CloseCardData, CloseCardCode } from "../shell/review/session-close-card.js";

interface SessionCloseState {
  /** agent session ids whose PTY exited and await close-detection (FIFO). */
  reported: string[];
  /** the card currently shown (null when none). */
  card: CloseCardData | null;
  /** ended-session cards waiting their turn — U5 coalesce: a second session ending while
   *  a card shows queues instead of clobbering it (deduped by sessionId). */
  queue: CloseCardData[];
  /** an agent TermView calls this on its Exit frame. */
  reportExit: (sessionId: string) => void;
  /** the detector consumed a reported id (poll done). */
  consume: (sessionId: string) => void;
  /** open the card for an ended session — or queue it if one is already showing. */
  show: (data: CloseCardData) => void;
  /** the CODE decision resolved (Merge / Discard / Keep): collapse to a brain-only card,
   *  or advance to the next queued session's card when no brain proposals remain. */
  resolveCode: () => void;
  /** dismiss the current card and surface the next queued one (does NOT re-fire a
   *  dismissed session — the dedup mark persists). */
  dismiss: () => void;
}

export const useSessionClose = create<SessionCloseState>((set) => ({
  reported: [],
  card: null,
  queue: [],
  reportExit: (sessionId) =>
    set((s) => (s.reported.includes(sessionId) ? s : { reported: [...s.reported, sessionId] })),
  consume: (sessionId) => set((s) => ({ reported: s.reported.filter((id) => id !== sessionId) })),
  show: (data) => set((s) => enqueueCard({ card: s.card, queue: s.queue }, data)),
  resolveCode: () =>
    set((s) => replaceCurrent({ card: s.card, queue: s.queue }, s.card ? cardWithoutCode(s.card) : null)),
  dismiss: () => set((s) => advanceQueue({ card: s.card, queue: s.queue })),
}));

/** Report an agent PTY exit from non-React code (the TermView onExit). */
export const reportAgentExit = (sessionId: string): void => useSessionClose.getState().reportExit(sessionId);

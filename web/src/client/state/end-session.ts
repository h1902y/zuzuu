// state/end-session.ts — the end-session confirm flow (one target at a time). Both
// entry points — the stage-header "End session" button and the nav ✕ — request the
// SAME dialog; the dialog (EndSessionDialog) owns the merge + close-card orchestration.
// This store holds only the target session + a busy flag while the daemon's squash-
// merge runs (busy locks the dialog so a stray dismiss can't strand a half-merge).
import { create } from "zustand";
import type { SessionInfo } from "#shared/index.js";

interface EndSessionState {
  /** the session the confirm dialog is open for, or null when closed. */
  target: SessionInfo | null;
  /** true while the daemon merges — the dialog is non-dismissable in this window. */
  busy: boolean;
  /** open the confirm dialog for a session (from either entry point). */
  request: (session: SessionInfo) => void;
  /** user-dismiss — a no-op while busy (can't cancel a merge mid-flight). */
  cancel: () => void;
  setBusy: (busy: boolean) => void;
  /** force-close after the end settles (clears regardless of busy). */
  done: () => void;
}

export const useEndSession = create<EndSessionState>((set) => ({
  target: null,
  busy: false,
  request: (session) => set({ target: session, busy: false }),
  cancel: () => set((s) => (s.busy ? s : { target: null })),
  setBusy: (busy) => set({ busy }),
  done: () => set({ target: null, busy: false }),
}));

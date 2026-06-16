// The center's open-session tabs (editor model) — a thin Zustand store over the
// pure reducer in open-tabs-logic.ts. View state only: which sessions are open in
// the center tab strip and which is focused. Reachable from non-React code
// (agent-launch's startAgentSession opens a tab on start), like useSessions.
import { create } from "zustand";
import {
  closeTab,
  focusTab,
  openTab,
  reconcileTabs,
  type OpenTabsCore,
} from "./open-tabs-logic";

interface OpenTabsState extends OpenTabsCore {
  /** open + focus a session tab (dedupe) */
  open: (id: string) => void;
  /** focus an already-open tab (no-op if not open) */
  focus: (id: string) => void;
  /** close a tab — removes it from the strip; does NOT end the session */
  close: (id: string) => void;
  /** drop tabs whose session vanished from `knownIds` (live tabs ∪ trace ids) */
  reconcile: (knownIds: Set<string>) => void;
}

export const useOpenTabs = create<OpenTabsState>((set) => ({
  openIds: [],
  activeId: null,
  open: (id) => set((s) => openTab(s, id)),
  focus: (id) => set((s) => focusTab(s, id)),
  close: (id) => set((s) => closeTab(s, id)),
  reconcile: (knownIds) => set((s) => reconcileTabs(s, knownIds)),
}));

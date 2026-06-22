// src/client/state/store.ts — the workbench's lean client state (zustand).
//
// Rung 4 keeps it small on purpose: the open sessions + which one is active,
// and the live terminal connection status (for the footer). The file tree and
// search own their own local React state; React Query owns server data. Rung 5
// grows the right-panel/modules state alongside this.

import { create } from "zustand";
import type { SessionInfo } from "#shared/index.js";
import { api } from "../lib/api.js";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

interface WorkbenchState {
  sessions: SessionInfo[];
  activeId: string | null;
  status: ConnStatus;

  refresh: () => Promise<void>;
  /** Create a shell (or agent) session and make it active. */
  open: (type?: "shell" | "agent") => Promise<SessionInfo | null>;
  setActive: (id: string) => void;
  close: (id: string) => Promise<void>;
  setStatus: (status: ConnStatus) => void;
}

export const useWorkbench = create<WorkbenchState>((set, get) => ({
  sessions: [],
  activeId: null,
  status: "connecting",

  refresh: async () => {
    const sessions = await api.listSessions().catch(() => []);
    set((s) => ({
      sessions,
      // keep the active session if it still exists, else fall back to the first
      activeId: sessions.some((x) => x.id === s.activeId) ? s.activeId : (sessions[0]?.id ?? null),
    }));
  },

  open: async (type = "shell") => {
    const created = await api.createSession({ type }).catch(() => null);
    if (created) set((s) => ({ sessions: [...s.sessions, created], activeId: created.id }));
    return created;
  },

  setActive: (id) => set({ activeId: id }),

  close: async (id) => {
    await api.closeSession(id).catch(() => {});
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id);
      return { sessions, activeId: s.activeId === id ? (sessions[0]?.id ?? null) : s.activeId };
    });
  },

  setStatus: (status) => set({ status }),
}));

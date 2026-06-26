// src/client/state/store.ts — the workbench's lean client state (zustand).
//
// The open sessions + the live terminal connection status (for the footer). The
// STAGE selection lives in shell/world-state (useWorld.selected) — this store only
// owns the session list + status; React Query owns server data.

import { create } from "zustand";
import type { SessionInfo } from "#shared/index.js";
import { api } from "../lib/api.js";
import { toast } from "./toast.js";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

interface WorkbenchState {
  sessions: SessionInfo[];
  status: ConnStatus;

  refresh: () => Promise<void>;
  /** Create a shell, or an agent session running a host CLI. Selecting it into the
   *  stage is the caller's job (useStartSession bridges open → useWorld.select). */
  open: (type?: "shell" | "agent", host?: string) => Promise<SessionInfo | null>;
  close: (id: string) => Promise<void>;
  setStatus: (status: ConnStatus) => void;
}

export const useWorkbench = create<WorkbenchState>((set) => ({
  sessions: [],
  status: "connecting",

  refresh: async () => {
    const sessions = await api.listSessions().catch(() => []);
    set({ sessions });
  },

  open: async (type = "shell", host) => {
    // an agent session runs the host CLI directly on the PTY (argv, no shell);
    // the daemon allowlists the command and gives it its own git worktree.
    const body = type === "agent" && host ? { type, command: host, host } : { type };
    const created = await api.createSession(body).catch(() => null);
    if (created) set((s) => ({ sessions: [...s.sessions, created] }));
    else toast(host ? `Couldn't start ${host}` : "Couldn't start a session", "error");
    return created;
  },

  close: async (id) => {
    await api.closeSession(id).catch(() => {});
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
  },

  setStatus: (status) => set({ status }),
}));

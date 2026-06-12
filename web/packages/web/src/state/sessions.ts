import { create } from "zustand";
import type { CreateSessionRequest, CwdPayload, SessionInfo } from "@zuzuu-web/protocol";
import { api } from "../lib/api";

export type SessionTab = SessionInfo & {
  /** live workspace-relative cwd from the daemon's poller */
  cwdLive?: CwdPayload;
};

interface SessionsState {
  tabs: SessionTab[];
  activeId: string | null;
  loaded: boolean;
  init: () => Promise<void>;
  create: (req?: CreateSessionRequest) => Promise<void>;
  close: (id: string) => Promise<void>;
  setActive: (id: string) => void;
  setTitle: (id: string, title: string) => void;
  setCwd: (id: string, cwd: CwdPayload) => void;
  markExited: (id: string) => void;
  /** drop all tabs so init() can re-seed for a new workspace */
  reset: () => void;
}

export const useSessions = create<SessionsState>((set, get) => ({
  tabs: [],
  activeId: null,
  loaded: false,

  init: async () => {
    if (get().loaded) return;
    // no auto-created shell: zero sessions is the default state — the
    // terminal pane shows the start-a-session card instead (Phase ④)
    const tabs = await api.listSessions();
    set({ tabs, activeId: tabs[tabs.length - 1]?.id ?? null, loaded: true });
  },

  create: async (req = {}) => {
    const session = await api.createSession(req);
    set((s) => ({ tabs: [...s.tabs, session], activeId: session.id }));
  },

  close: async (id) => {
    await api.closeSession(id).catch(() => {});
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeId =
        s.activeId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeId;
      return { tabs, activeId };
    });
  },

  setActive: (id) => set({ activeId: id }),

  setTitle: (id, title) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
    })),

  setCwd: (id, cwd) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, cwdLive: cwd } : t)),
    })),

  markExited: (id) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, alive: false } : t)),
    })),

  reset: () => set({ tabs: [], activeId: null, loaded: false }),
}));

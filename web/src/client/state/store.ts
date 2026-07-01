// src/client/state/store.ts — the workbench's lean client state (zustand).
//
// The open sessions + the live terminal connection status (for the footer). The
// STAGE selection lives in shell/world-state (useWorld.selected) — this store only
// owns the session list + status; React Query owns server data.

import { create } from "zustand";
import type { SessionCloseResult, SessionInfo } from "#shared/index.js";
import { api } from "../lib/api.js";
import { toast } from "./toast.js";
import { requestKickoff } from "../composer/session-kickoff.js";
import { useKickoffPref } from "./kickoff-pref.js";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

interface WorkbenchState {
  sessions: SessionInfo[];
  status: ConnStatus;

  refresh: () => Promise<void>;
  /** Create a shell, or an agent session running a host CLI. `opts.cwd` is a
   *  workspace-relative dir (U8: the conflict→Resolve flow opens a shell at the held
   *  worktree). Selecting it into the stage is the caller's job (useStartSession
   *  bridges open → useWorld.select). */
  open: (type?: "shell" | "agent", host?: string, opts?: { cwd?: string }) => Promise<SessionInfo | null>;
  /** End a session. Resolves with the agent close result (merge + post-close pending
   *  count) once the daemon's squash-merge settles, or null for a shell. */
  close: (id: string) => Promise<SessionCloseResult | null>;
  setStatus: (status: ConnStatus) => void;

  /** ACP drive-lane sessions — a client-side registry (the daemon holds the live ones;
   *  this lists them in the SESSIONS nav and reconciles against GET /api/acp liveness,
   *  pruning ghost rows after a project switch / idle-close) (U7/R6, U5-client/R11). */
  acpSessions: { id: string; label: string; createdAt: number }[];
  registerAcp: (id: string) => void;
  dropAcp: (id: string) => void;
  reconcileAcp: (liveIds: string[]) => void;
}

export const useWorkbench = create<WorkbenchState>((set) => ({
  sessions: [],
  status: "connecting",
  acpSessions: [],

  refresh: async () => {
    const sessions = await api.listSessions().catch(() => []);
    set({ sessions });
  },

  open: async (type = "shell", host, opts) => {
    // an agent session runs the host CLI directly on the PTY (argv, no shell);
    // the daemon allowlists the command and gives it its own git worktree.
    const base = type === "agent" && host ? { type, command: host, host } : { type };
    const body = opts?.cwd ? { ...base, cwd: opts.cwd } : base;
    const created = await api.createSession(body).catch(() => null);
    if (created) {
      set((s) => ({ sessions: [...s.sessions, created] }));
      // a freshly-started AGENT gets the session-start kickoff (its Composer delivers
      // it once the CLI is up) — when the Settings toggle is on. Only here: reattached
      // sessions are never kicked.
      if (type === "agent" && useKickoffPref.getState().enabled) requestKickoff(created.id);
    } else toast(host ? `Couldn't start ${host}` : "Couldn't start a session", "error");
    return created;
  },

  close: async (id) => {
    const res = await api.closeSession(id).catch(() => null);
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
    return res?.closeResult ?? null;
  },

  setStatus: (status) => set({ status }),

  registerAcp: (id) =>
    set((s) => (s.acpSessions.some((a) => a.id === id)
      ? s
      : { acpSessions: [...s.acpSessions, { id, label: `Claude Code ${s.acpSessions.length + 1}`, createdAt: Date.now() }] })),
  dropAcp: (id) => set((s) => ({ acpSessions: s.acpSessions.filter((a) => a.id !== id) })),
  reconcileAcp: (liveIds) =>
    set((s) => {
      const live = new Set(liveIds);
      const kept = s.acpSessions.filter((a) => live.has(a.id));
      return kept.length === s.acpSessions.length ? s : { acpSessions: kept };
    }),
}));

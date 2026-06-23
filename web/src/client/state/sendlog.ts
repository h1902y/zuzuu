// src/client/state/sendlog.ts — the composer's local send-log.
//
// An append-only record, per session, of the user's turns (what the composer
// injected). DELIBERATELY separate from the terminal output (xterm renders that):
// the "two data structures, never one" rule — we never parse PTY bytes into
// messages. The shape borrows UIMessage's {id, role, content} for future interop,
// not its SDK.

import { create } from "zustand";

export interface Turn {
  id: string;
  sessionId: string;
  role: "user";
  content: string;
  ts: number;
}

interface SendLogState {
  turns: Turn[];
  /** append a user turn for a session */
  add: (sessionId: string, content: string) => void;
  /** the turns for one session, in order */
  forSession: (sessionId: string) => Turn[];
  /** drop a session's turns (on close) */
  clear: (sessionId: string) => void;
}

let seq = 0;

export const useSendLog = create<SendLogState>((set, get) => ({
  turns: [],
  add: (sessionId, content) =>
    set((s) => ({
      turns: [...s.turns, { id: `t${++seq}`, sessionId, role: "user", content, ts: Date.now() }],
    })),
  forSession: (sessionId) => get().turns.filter((t) => t.sessionId === sessionId),
  clear: (sessionId) => set((s) => ({ turns: s.turns.filter((t) => t.sessionId !== sessionId) })),
}));

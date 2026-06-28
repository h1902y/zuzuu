// src/server/session-manager.ts — one job: the live registry of Sessions.
//
// Owns the id→Session map and the lifecycle fan-out (create/get/list/close/
// shutdown). The Session itself (PTY + render-gated flow control + the headless
// mirror) lives in session.ts; this file only tracks and reaps them.

import os from "node:os";
import type { SessionInfo } from "#shared/index.js";
import { Session, type SessionSpawnOpts } from "./session.js";

export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly defaultCwd: string = os.homedir()) {}

  create(cwd?: string, cols?: number, rows?: number, opts?: SessionSpawnOpts): Session {
    const session = new Session(cwd ?? this.defaultCwd, this.defaultCwd, cols, rows, () => {}, opts);
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /** Drop a session from the registry without killing it — for the graceful-end
   *  path, where endGraceful() has already killed the PTY and awaited the merge. */
  drop(id: string): boolean {
    return this.sessions.delete(id);
  }

  list(): SessionInfo[] {
    return [...this.sessions.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => s.info());
  }

  close(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.kill();
    this.sessions.delete(id);
    return true;
  }

  shutdown(): void {
    for (const session of this.sessions.values()) session.kill();
    this.sessions.clear();
  }
}

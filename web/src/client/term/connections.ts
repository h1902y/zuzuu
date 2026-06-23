// src/client/term/connections.ts — a tiny registry of live TermConnections keyed
// by session id, so the composer can send to a session's PTY without owning the
// xterm. TermView registers on connect and unregisters on dispose; the composer
// looks up the connection at SEND time. Purely additive — it never touches the
// ack/flow-control loop inside connection.ts.

import type { TermConnection } from "./connection.js";

const conns = new Map<string, TermConnection>();

export function registerTermConn(id: string, c: TermConnection): void {
  conns.set(id, c);
}

export function unregisterTermConn(id: string): void {
  conns.delete(id);
}

export function getTermConn(id: string): TermConnection | undefined {
  return conns.get(id);
}

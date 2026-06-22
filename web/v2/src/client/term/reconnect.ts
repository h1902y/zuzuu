// src/client/term/reconnect.ts — the terminal reconnect policy (pure, testable).
//
// Reconnect INDEFINITELY with capped exponential backoff, so a laptop sleep or a
// long network blip recovers on its own — the server-side PTY persists and
// replays a snapshot on reattach, so nothing is lost. The only terminal states
// are a deliberate user close (dispose) or close code 4000 ("attached
// elsewhere"). wake/online events (in connection.ts) short-circuit the wait.

export const RECONNECT_BASE_MS = 500;
export const RECONNECT_MAX_MS = 15000;

export interface ReconnectInput {
  /** how many reconnect attempts have already been made */
  retries: number;
  /** the WebSocket close code (4000 = "attached elsewhere") */
  code: number;
  /** the client deliberately closed (dispose) — never reconnect */
  closedByUser: boolean;
}

export interface ReconnectDecision {
  retry: boolean;
  delayMs: number;
}

/** Whether (and after how long) to reconnect after a socket close. */
export function reconnectDecision({ retries, code, closedByUser }: ReconnectInput): ReconnectDecision {
  if (closedByUser || code === 4000) return { retry: false, delayMs: 0 };
  return { retry: true, delayMs: Math.min(RECONNECT_BASE_MS * 2 ** retries, RECONNECT_MAX_MS) };
}

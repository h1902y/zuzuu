// Wave A (resilience): the terminal reconnect policy — extracted pure from
// TermConnection so it's unit-testable. This is the CURRENT behavior verbatim
// (a behavior-preserving extraction); the resilience improvement evolves it next.

export const RECONNECT_BASE_MS = 500;
export const RECONNECT_MAX_MS = 5000;
export const RECONNECT_MAX_RETRIES = 5;

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
  if (retries >= RECONNECT_MAX_RETRIES) return { retry: false, delayMs: 0 };
  return { retry: true, delayMs: Math.min(RECONNECT_BASE_MS * 2 ** retries, RECONNECT_MAX_MS) };
}

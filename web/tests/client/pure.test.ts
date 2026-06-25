// tests/client/pure — the framework-free client logic (no DOM, no fetch).

import { describe, it, expect } from "vitest";
import { reconnectDecision, RECONNECT_MAX_MS, RECONNECT_BASE_MS } from "../../src/client/term/reconnect.js";

describe("reconnectDecision", () => {
  it("never reconnects after a deliberate close or a takeover (code 4000)", () => {
    expect(reconnectDecision({ retries: 0, code: 1000, closedByUser: true }).retry).toBe(false);
    expect(reconnectDecision({ retries: 3, code: 4000, closedByUser: false }).retry).toBe(false);
  });
  it("reconnects indefinitely with capped exponential backoff", () => {
    expect(reconnectDecision({ retries: 0, code: 1006, closedByUser: false })).toEqual({ retry: true, delayMs: RECONNECT_BASE_MS });
    expect(reconnectDecision({ retries: 2, code: 1006, closedByUser: false }).delayMs).toBe(RECONNECT_BASE_MS * 4);
    // far-out retries clamp to the ceiling (one quiet attempt at the cap)
    expect(reconnectDecision({ retries: 50, code: 1006, closedByUser: false }).delayMs).toBe(RECONNECT_MAX_MS);
  });
});

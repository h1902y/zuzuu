// Wave A (resilience): the reconnect policy, extracted from TermConnection so it
// can be unit-tested (the class itself owns a real WebSocket + timers).
//
// Evolved policy (resilience): reconnect INDEFINITELY with capped exponential
// backoff, so a laptop sleep / long network blip recovers automatically instead
// of dead-ending at "disconnected". Still never reconnect on a deliberate close
// (user dispose) or code 4000 (attached elsewhere).
import { describe, expect, it } from "vitest";
import { RECONNECT_MAX_MS, reconnectDecision } from "./reconnect";

describe("reconnectDecision", () => {
  it("does not retry when the user closed the connection", () => {
    expect(reconnectDecision({ retries: 0, code: 1000, closedByUser: true })).toEqual({ retry: false, delayMs: 0 });
  });

  it("does not retry on code 4000 (attached elsewhere)", () => {
    expect(reconnectDecision({ retries: 0, code: 4000, closedByUser: false })).toEqual({ retry: false, delayMs: 0 });
  });

  it("retries with exponential backoff, capped at RECONNECT_MAX_MS", () => {
    const delays = [0, 1, 2, 3, 4, 5, 6].map((retries) =>
      reconnectDecision({ retries, code: 1006, closedByUser: false }).delayMs,
    );
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, RECONNECT_MAX_MS, RECONNECT_MAX_MS]);
  });

  it("keeps retrying indefinitely (survives long sleeps), never giving up", () => {
    for (const retries of [5, 10, 50, 1000]) {
      const d = reconnectDecision({ retries, code: 1006, closedByUser: false });
      expect(d.retry).toBe(true);
      expect(d.delayMs).toBe(RECONNECT_MAX_MS); // pinned at the cap
    }
  });
});

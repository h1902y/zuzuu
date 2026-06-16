// Wave A (resilience): the reconnect policy, extracted from TermConnection so it
// can be unit-tested (the class itself owns a real WebSocket + timers).
//
// This file starts as a CHARACTERIZATION of the CURRENT behavior (5-retry cap,
// backoff min(500·2^n, 5000), no-retry on user-close / code 4000), so the
// extraction is proven faithful before we evolve the policy.
import { describe, expect, it } from "vitest";
import { reconnectDecision } from "./reconnect";

describe("reconnectDecision — current behavior (characterization)", () => {
  it("does not retry when the user closed the connection", () => {
    expect(reconnectDecision({ retries: 0, code: 1000, closedByUser: true })).toEqual({ retry: false, delayMs: 0 });
  });

  it("does not retry on code 4000 (attached elsewhere)", () => {
    expect(reconnectDecision({ retries: 0, code: 4000, closedByUser: false })).toEqual({ retry: false, delayMs: 0 });
  });

  it("retries with exponential backoff for the first attempts", () => {
    const delays = [0, 1, 2, 3, 4].map((retries) => reconnectDecision({ retries, code: 1006, closedByUser: false }));
    expect(delays).toEqual([
      { retry: true, delayMs: 500 },
      { retry: true, delayMs: 1000 },
      { retry: true, delayMs: 2000 },
      { retry: true, delayMs: 4000 },
      { retry: true, delayMs: 5000 }, // capped
    ]);
  });

  it("gives up after 5 retries", () => {
    expect(reconnectDecision({ retries: 5, code: 1006, closedByUser: false })).toEqual({ retry: false, delayMs: 0 });
  });
});

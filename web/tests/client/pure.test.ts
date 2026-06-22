// tests/client/pure — the framework-free client logic (no DOM, no fetch).

import { describe, it, expect } from "vitest";
import { reconnectDecision, RECONNECT_MAX_MS, RECONNECT_BASE_MS } from "../../src/client/term/reconnect.js";
import { canSearch, shiftRanges, MIN_QUERY_LEN } from "../../src/client/explorer/search-logic.js";

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

describe("search-logic", () => {
  it("gates search on a 2-char trimmed floor", () => {
    expect(canSearch(" a ")).toBe(false);
    expect(canSearch("ab")).toBe(true);
    expect(MIN_QUERY_LEN).toBe(2);
  });
  it("shifts highlight ranges left by trimmed leading whitespace", () => {
    // "  foo" trimStart drops 2 chars → a [2,5) match becomes [0,3)
    expect(shiftRanges({ text: "  foo", ranges: [[2, 5]] })).toEqual([[0, 3]]);
    // no leading space → unchanged
    expect(shiftRanges({ text: "foo", ranges: [[0, 3]] })).toEqual([[0, 3]]);
    // a range fully inside the trimmed prefix collapses away
    expect(shiftRanges({ text: "    x", ranges: [[0, 2]] })).toEqual([]);
  });
});

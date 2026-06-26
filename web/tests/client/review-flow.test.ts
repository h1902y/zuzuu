// P2.4 — the focused decision flow over the review queue.
import { describe, it, expect } from "vitest";
import type { StagedSummary } from "../../src/shared/index.js";
import { clampFocus, moveFocus, focusedId } from "../../src/client/shell/review/review-flow.js";

const q = (n: number): StagedSummary[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, module: "m", title: `t${i}` }));

describe("clampFocus", () => {
  it("empty → -1", () => expect(clampFocus(0, 3)).toBe(-1));
  it("clamps over/under into range", () => {
    expect(clampFocus(3, 9)).toBe(2);
    expect(clampFocus(3, -5)).toBe(0);
    expect(clampFocus(3, 1)).toBe(1);
  });
});

describe("moveFocus", () => {
  it("empty → -1", () => expect(moveFocus(0, 0, 1)).toBe(-1));
  it("wraps forward and backward", () => {
    expect(moveFocus(3, 2, 1)).toBe(0);
    expect(moveFocus(3, 0, -1)).toBe(2);
    expect(moveFocus(3, 1, 1)).toBe(2);
  });
  it("an unset cursor (-1) starts at the first item", () => {
    expect(moveFocus(3, -1, 1)).toBe(1);
    expect(moveFocus(3, -1, -1)).toBe(2);
  });
});

describe("focusedId", () => {
  it("returns the id at the cursor, null out of range", () => {
    expect(focusedId(q(3), 1)).toBe("s1");
    expect(focusedId(q(3), -1)).toBeNull();
    expect(focusedId(q(3), 9)).toBeNull();
  });
});

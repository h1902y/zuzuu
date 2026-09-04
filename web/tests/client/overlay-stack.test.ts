// ds/kit/overlay/overlay-stack.ts — the shared LIFO overlay stack (U1,
// curried-plotting-coral.md). Pure — no DOM, no React.
import { describe, it, expect } from "vitest";
import {
  EMPTY_OVERLAY_STACK, pushOverlay, popOverlay, topOf, isTopmost, overlayStackReducer,
} from "../../src/client/ds/kit/overlay/overlay-stack.js";

describe("push/pop maintain LIFO order", () => {
  it("push appends (the most recently opened overlay is topmost)", () => {
    let s = EMPTY_OVERLAY_STACK;
    expect(topOf(s)).toBeNull();
    s = pushOverlay(s, "a");
    expect(topOf(s)).toBe("a");
    s = pushOverlay(s, "b");
    expect(topOf(s)).toBe("b"); // b opened after a — b is on top
    s = pushOverlay(s, "c");
    expect(s).toEqual(["a", "b", "c"]);
    expect(topOf(s)).toBe("c");
  });

  it("push is idempotent — re-registering an open id never reorders it", () => {
    let s = pushOverlay(EMPTY_OVERLAY_STACK, "a");
    s = pushOverlay(s, "b");
    s = pushOverlay(s, "a"); // re-push a, already open
    expect(s).toEqual(["a", "b"]); // a stays where it was, NOT bumped to the front
    expect(topOf(s)).toBe("b");
  });

  it("pop removes an id wherever it sits — not just 'pop the last'", () => {
    let s: readonly string[] = ["a", "b", "c"];
    s = popOverlay(s, "a"); // closing the BOTTOM overlay while b/c remain open
    expect(s).toEqual(["b", "c"]);
    expect(topOf(s)).toBe("c"); // c is still topmost — untouched
    s = popOverlay(s, "c"); // now closing the top
    expect(s).toEqual(["b"]);
    expect(topOf(s)).toBe("b");
  });

  it("popping an id that isn't present, or an empty stack, is a safe no-op", () => {
    expect(popOverlay(EMPTY_OVERLAY_STACK, "ghost")).toEqual(EMPTY_OVERLAY_STACK);
    const s = ["a", "b"] as const;
    expect(popOverlay(s, "ghost")).toBe(s); // same reference — no needless copy either
  });
});

describe("isTopmost/topOf after nested opens and out-of-order closes", () => {
  it("nested opens: each new overlay becomes topmost; isTopmost tracks it", () => {
    let s = EMPTY_OVERLAY_STACK;
    s = pushOverlay(s, "dialog");
    expect(isTopmost(s, "dialog")).toBe(true);
    s = pushOverlay(s, "popover"); // opened on top of the dialog
    expect(isTopmost(s, "dialog")).toBe(false); // dialog is no longer topmost
    expect(isTopmost(s, "popover")).toBe(true);
    s = pushOverlay(s, "tooltip"); // three deep
    expect(isTopmost(s, "tooltip")).toBe(true);
    expect(isTopmost(s, "popover")).toBe(false);
    expect(isTopmost(s, "dialog")).toBe(false);
  });

  it("closing the MIDDLE overlay out of order promotes nothing — the top stays the top", () => {
    let s = pushOverlay(EMPTY_OVERLAY_STACK, "dialog");
    s = pushOverlay(s, "popover");
    s = pushOverlay(s, "tooltip");
    s = popOverlay(s, "popover"); // the middle one closes first
    expect(s).toEqual(["dialog", "tooltip"]);
    expect(isTopmost(s, "tooltip")).toBe(true); // unaffected — it was already on top
    expect(isTopmost(s, "dialog")).toBe(false);
  });

  it("closing the TOP overlay promotes the next one down", () => {
    let s = pushOverlay(EMPTY_OVERLAY_STACK, "dialog");
    s = pushOverlay(s, "popover");
    s = popOverlay(s, "popover");
    expect(isTopmost(s, "dialog")).toBe(true); // now topmost — the review-vs-agent-view bug fix
  });

  it("empty stack: isTopmost is false for anything, topOf is null", () => {
    expect(isTopmost(EMPTY_OVERLAY_STACK, "anything")).toBe(false);
    expect(topOf(EMPTY_OVERLAY_STACK)).toBeNull();
  });
});

describe("the reducer form (the React binding's dispatch shape)", () => {
  it("push/pop actions delegate to the pure functions", () => {
    let s = overlayStackReducer(EMPTY_OVERLAY_STACK, { type: "push", id: "a" });
    s = overlayStackReducer(s, { type: "push", id: "b" });
    expect(s).toEqual(["a", "b"]);
    s = overlayStackReducer(s, { type: "pop", id: "a" });
    expect(s).toEqual(["b"]);
  });
});

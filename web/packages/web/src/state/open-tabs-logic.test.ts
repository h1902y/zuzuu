// U1: the open-tabs reducer (center session tab strip). Pure data tests.
import { describe, expect, it } from "vitest";
import {
  closeTab,
  focusTab,
  neighborAfterClose,
  openTab,
  reconcileTabs,
  type OpenTabsCore,
} from "./open-tabs-logic";

const S = (openIds: string[], activeId: string | null): OpenTabsCore => ({ openIds, activeId });

describe("openTab", () => {
  it("opens into an empty strip and focuses it", () => {
    expect(openTab(S([], null), "a")).toEqual({ openIds: ["a"], activeId: "a" });
  });
  it("opening an already-open id refocuses it without duplicating", () => {
    expect(openTab(S(["a", "b"], "b"), "a")).toEqual({ openIds: ["a", "b"], activeId: "a" });
  });
  it("opening a new id appends to the end and focuses it", () => {
    expect(openTab(S(["a", "b"], "a"), "c")).toEqual({ openIds: ["a", "b", "c"], activeId: "c" });
  });
});

describe("focusTab", () => {
  it("focuses an open id", () => {
    expect(focusTab(S(["a", "b"], "a"), "b").activeId).toBe("b");
  });
  it("is a no-op for a non-open id (returns same state)", () => {
    const s = S(["a", "b"], "a");
    expect(focusTab(s, "zzz")).toBe(s);
  });
});

describe("neighborAfterClose", () => {
  it("prefers the right neighbor", () => {
    expect(neighborAfterClose(["a", "b", "c"], "b")).toBe("c");
  });
  it("falls back to the left neighbor when closing the last", () => {
    expect(neighborAfterClose(["a", "b"], "b")).toBe("a");
  });
  it("null when closing the only tab", () => {
    expect(neighborAfterClose(["a"], "a")).toBeNull();
  });
});

describe("closeTab", () => {
  it("closing a non-active tab keeps the active one", () => {
    expect(closeTab(S(["a", "b", "c"], "b"), "a")).toEqual({ openIds: ["b", "c"], activeId: "b" });
  });
  it("closing the active tab focuses the right neighbor", () => {
    expect(closeTab(S(["a", "b", "c"], "b"), "b")).toEqual({ openIds: ["a", "c"], activeId: "c" });
  });
  it("closing the active last tab focuses the left neighbor", () => {
    expect(closeTab(S(["a", "b"], "b"), "b")).toEqual({ openIds: ["a"], activeId: "a" });
  });
  it("closing the only tab → empty / null (the resting state)", () => {
    expect(closeTab(S(["a"], "a"), "a")).toEqual({ openIds: [], activeId: null });
  });
  it("closing an absent id is a no-op", () => {
    const s = S(["a", "b"], "a");
    expect(closeTab(s, "zzz")).toBe(s);
  });
});

describe("reconcileTabs", () => {
  it("drops a tab whose session vanished", () => {
    expect(reconcileTabs(S(["a", "b"], "a"), new Set(["a"]))).toEqual({ openIds: ["a"], activeId: "a" });
  });
  it("all-known → unchanged (same reference)", () => {
    const s = S(["a", "b"], "b");
    expect(reconcileTabs(s, new Set(["a", "b"]))).toBe(s);
  });
  it("active removed → focuses a surviving neighbor", () => {
    expect(reconcileTabs(S(["a", "b", "c"], "b"), new Set(["a", "c"]))).toEqual({
      openIds: ["a", "c"],
      activeId: "c",
    });
  });
  it("active removed with only a left survivor", () => {
    expect(reconcileTabs(S(["a", "b"], "b"), new Set(["a"]))).toEqual({ openIds: ["a"], activeId: "a" });
  });
  it("all removed → empty / null", () => {
    expect(reconcileTabs(S(["a", "b"], "a"), new Set())).toEqual({ openIds: [], activeId: null });
  });
});

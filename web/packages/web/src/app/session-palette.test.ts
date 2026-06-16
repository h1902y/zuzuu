// W1-D: pure builder for the cmd-K palette's "Sessions" group.
import { describe, expect, it } from "vitest";
import { sessionPaletteItems } from "./session-palette";

describe("sessionPaletteItems", () => {
  it("empty tabs, no active → no items", () => {
    expect(sessionPaletteItems([], null)).toEqual([]);
  });

  it("empty tabs but an active id → no focus items, no close (nothing open)", () => {
    // No tabs means nothing to switch to; a stale activeId yields no items.
    expect(sessionPaletteItems([], "x")).toEqual([]);
  });

  it("several tabs, no active → a focus item per tab, no close item", () => {
    const items = [
      { id: "a", label: "claude-code" },
      { id: "b", label: "codex" },
    ];
    expect(sessionPaletteItems(items, null)).toEqual([
      { id: "session-focus-a", title: "Switch to: claude-code", action: "focus", sessionId: "a" },
      { id: "session-focus-b", title: "Switch to: codex", action: "focus", sessionId: "b" },
    ]);
  });

  it("several tabs with an active id → focus items + a close-current item", () => {
    const items = [
      { id: "a", label: "claude-code" },
      { id: "b", label: "codex" },
    ];
    expect(sessionPaletteItems(items, "b")).toEqual([
      { id: "session-focus-a", title: "Switch to: claude-code", action: "focus", sessionId: "a" },
      { id: "session-focus-b", title: "Switch to: codex", action: "focus", sessionId: "b" },
      { id: "session-close-current", title: "Close current tab", action: "close", sessionId: "b" },
    ]);
  });

  it("single tab, active → one focus item + close current", () => {
    const items = [{ id: "a", label: "claude-code" }];
    expect(sessionPaletteItems(items, "a")).toEqual([
      { id: "session-focus-a", title: "Switch to: claude-code", action: "focus", sessionId: "a" },
      { id: "session-close-current", title: "Close current tab", action: "close", sessionId: "a" },
    ]);
  });
});

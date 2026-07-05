// tests/client/toolbar-popover-model.test.ts — U4's Grid.tsx/Everything.tsx
// toolbar-popover coordinator (curried-plotting-coral.md): Filter/Group/Sort and
// the separate +Column FieldConfigPanel popover must never be open at once.
import { describe, it, expect } from "vitest";
import { toggleToolbarPopover, type ToolbarPopoverKey } from "../../src/client/shell/stage/toolbar-popover-model.js";

describe("toggleToolbarPopover — one toolbar popover open at a time", () => {
  it("opens a popover from closed", () => {
    expect(toggleToolbarPopover(null, "filter")).toBe("filter");
  });

  it("toggling the currently-open popover closes it", () => {
    expect(toggleToolbarPopover("filter", "filter")).toBeNull();
  });

  it("opening a DIFFERENT popover switches to it — the old one is implicitly closed", () => {
    expect(toggleToolbarPopover("filter", "group")).toBe("group");
    expect(toggleToolbarPopover("group", "sort")).toBe("sort");
  });

  it("the separate +column popover is mutually exclusive with filter/group/sort", () => {
    expect(toggleToolbarPopover("filter", "column")).toBe("column");
    expect(toggleToolbarPopover("column", "sort")).toBe("sort");
  });

  it("covers every ToolbarPopoverKey exhaustively, opening cleanly from null", () => {
    const keys: readonly ToolbarPopoverKey[] = ["filter", "group", "sort", "column"];
    for (const k of keys) expect(toggleToolbarPopover(null, k)).toBe(k);
  });
});

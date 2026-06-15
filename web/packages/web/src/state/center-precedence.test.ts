import { describe, expect, it } from "vitest";
import { centerView } from "./center-precedence";

describe("centerView precedence", () => {
  it("editor wins over everything when files are open", () => {
    expect(centerView(true, null)).toEqual({ kind: "editor" });
    expect(centerView(true, { kind: "module", key: "knowledge" })).toEqual({ kind: "editor" });
  });

  it("a selected module shows its detail when no files are open", () => {
    expect(centerView(false, { kind: "module", key: "memory" })).toEqual({
      kind: "module",
      key: "memory",
    });
  });

  it("falls back to the single-focus session home with no files and no selection", () => {
    expect(centerView(false, null)).toEqual({ kind: "home" });
  });

  // T4: there is NO separate `session` center view. A past session is viewed
  // INSIDE the home surface (the slim picker selects which session the center
  // renders as a tree); selecting a session never produces a center detail page.
  // The only center selections are module (or editor by precedence) — everything
  // session-shaped resolves to `home`.
  it("a session is never a center view — it's viewed inside the home surface", () => {
    expect(centerView(false, null)).toEqual({ kind: "home" });
    expect(centerView(false, { kind: "module", key: "knowledge" })).toEqual({ kind: "module", key: "knowledge" });
    expect(centerView(true, null)).toEqual({ kind: "editor" });
  });
});

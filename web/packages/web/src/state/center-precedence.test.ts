import { describe, expect, it } from "vitest";
import { centerView } from "./center-precedence";

describe("centerView precedence", () => {
  it("editor wins over everything when files are open", () => {
    expect(centerView(true, null)).toEqual({ kind: "editor" });
    expect(centerView(true, { kind: "module", key: "knowledge" })).toEqual({ kind: "editor" });
    expect(centerView(true, { kind: "session", id: "s1" })).toEqual({ kind: "editor" });
  });

  it("a selected module shows its detail when no files are open", () => {
    expect(centerView(false, { kind: "module", key: "memory" })).toEqual({
      kind: "module",
      key: "memory",
    });
  });

  it("a selected session shows its detail when no files are open", () => {
    expect(centerView(false, { kind: "session", id: "ses_x" })).toEqual({
      kind: "session",
      id: "ses_x",
    });
  });

  it("falls back to the sessions home with no files and no selection", () => {
    expect(centerView(false, null)).toEqual({ kind: "home" });
  });
});

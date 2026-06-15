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

  // U5: the active-session band/header lives inside the HOME surface (the live
  // terminal + history). Opening the active session focuses its PTY tab — it
  // does NOT create a center `session` selection — so an open active session
  // still resolves to `home`, never resurrecting a separate band as a detail.
  it("an open active session stays in the home surface (the band never becomes a detail)", () => {
    // no selection (the active session is focused via useSessions, not openSession)
    expect(centerView(false, null)).toEqual({ kind: "home" });
    // a module/editor still wins over home by precedence, unchanged by U5
    expect(centerView(false, { kind: "module", key: "knowledge" })).toEqual({ kind: "module", key: "knowledge" });
    expect(centerView(true, null)).toEqual({ kind: "editor" });
  });
});

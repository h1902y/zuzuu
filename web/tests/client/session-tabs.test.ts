// P2.8 — the session stage's Terminal · Changes tabs.
import { describe, it, expect } from "vitest";
import { sessionTabs } from "../../src/client/shell/session/session-tabs.js";

describe("sessionTabs", () => {
  it("always offers Terminal then Changes", () => {
    expect(sessionTabs(0).map((t) => t.key)).toEqual(["terminal", "changes"]);
  });
  it("badges the Changes tab when proposals are pending", () => {
    expect(sessionTabs(0)[1]!.label).toBe("Changes");
    expect(sessionTabs(3)[1]!.label).toBe("Changes · 3");
  });
});

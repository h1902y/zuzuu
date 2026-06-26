// U6 — the client home-state deriver. Full enum coverage of mode, current rung,
// per-rung status, and the setup-node visibility.
import { describe, it, expect } from "vitest";
import {
  homeMode, currentRung, rungStatus, shouldShowSetupNode, RUNGS,
} from "../../src/client/shell/project-home-state.js";
import type { ProjectStateKind } from "#shared/index.js";

const ALL: ProjectStateKind[] = ["not-a-repo", "no-project", "hooks-off", "no-activity", "steady"];

describe("homeMode", () => {
  it("onboarding for every non-steady state, steady otherwise", () => {
    expect(ALL.map(homeMode)).toEqual(["onboarding", "onboarding", "onboarding", "onboarding", "steady"]);
  });
});

describe("currentRung", () => {
  it("maps each state to its next action", () => {
    expect(currentRung("not-a-repo")).toBe("git-init");
    expect(currentRung("no-project")).toBe("init");
    expect(currentRung("hooks-off")).toBe("enable");
    expect(currentRung("no-activity")).toBe("session");
    expect(currentRung("steady")).toBe("review");
  });
});

describe("rungStatus", () => {
  it("done < current < upcoming by progress", () => {
    // hooks-off: git-init + init done, enable current, session/review upcoming
    expect(rungStatus("hooks-off", "git-init")).toBe("done");
    expect(rungStatus("hooks-off", "init")).toBe("done");
    expect(rungStatus("hooks-off", "enable")).toBe("current");
    expect(rungStatus("hooks-off", "session")).toBe("upcoming");
    expect(rungStatus("hooks-off", "review")).toBe("upcoming");
  });
  it("not-a-repo: nothing done, git-init current", () => {
    expect(RUNGS.map((r) => rungStatus("not-a-repo", r))).toEqual([
      "current", "upcoming", "upcoming", "upcoming", "upcoming",
    ]);
  });
  it("steady: every setup rung done, review is the live handoff", () => {
    expect(RUNGS.map((r) => rungStatus("steady", r))).toEqual([
      "done", "done", "done", "done", "current",
    ]);
  });
});

describe("shouldShowSetupNode", () => {
  it("hidden only at steady", () => {
    expect(ALL.map(shouldShowSetupNode)).toEqual([true, true, true, true, false]);
  });
});

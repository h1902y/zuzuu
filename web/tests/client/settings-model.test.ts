// P3.3 — the per-project Settings derivations.
import { describe, it, expect } from "vitest";
import { hostStatusLabel, canEnable, projectStateLabel } from "../../src/client/shell/settings/settings-model.js";

describe("hostStatusLabel", () => {
  it("no host", () => expect(hostStatusLabel({ kind: null, enabled: false })).toBe("No host detected"));
  it("detected but not enabled", () => expect(hostStatusLabel({ kind: "claude", enabled: false })).toBe("claude · detected, not enabled"));
  it("enabled", () => expect(hostStatusLabel({ kind: "claude", enabled: true })).toBe("claude · enabled"));
});

describe("canEnable", () => {
  it("true only when a host is present and not yet enabled", () => {
    expect(canEnable({ kind: "claude", enabled: false })).toBe(true);
    expect(canEnable({ kind: "claude", enabled: true })).toBe(false);
    expect(canEnable({ kind: null, enabled: false })).toBe(false);
  });
});

describe("projectStateLabel", () => {
  it("maps each state to a human label", () => {
    expect(projectStateLabel("not-a-repo")).toBe("Not a git repository");
    expect(projectStateLabel("no-project")).toBe("Not initialized");
    expect(projectStateLabel("hooks-off")).toBe("Initialized · hooks off");
    expect(projectStateLabel("no-activity")).toBe("Enabled · no activity yet");
    expect(projectStateLabel("steady")).toBe("Active");
  });
});

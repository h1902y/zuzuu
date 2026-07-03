// P3.3 — the per-project Settings derivations.
import { describe, it, expect } from "vitest";
import { hostStatusLabel, canEnable, projectStateLabel, rootModeLabel, daemonPortLabel } from "../../src/client/shell/settings/settings-model.js";

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

describe("rootModeLabel — §G.4 the 'under the hood' section", () => {
  it("names the distinction resolveHome makes on every read", () => {
    expect(rootModeLabel(true)).toBe("yes — modules live at the repo root, no .zuzuu/");
    expect(rootModeLabel(false)).toBe("no — modules live under .zuzuu/");
  });
});

describe("daemonPortLabel", () => {
  it("prefixes a real port with a colon", () => expect(daemonPortLabel("8795")).toBe(":8795"));
  it("a blank port (e.g. default 80/443) reads as '(default)'", () => expect(daemonPortLabel("")).toBe("(default)"));
});

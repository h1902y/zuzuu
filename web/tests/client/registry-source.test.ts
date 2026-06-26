// U9 — the registry-backed Projects Home client logic (group sectioning + source).
import { describe, it, expect } from "vitest";
import type { ProjectSummary } from "../../src/shared/index.js";
import { sectionByGroup, isRegistrySource, sourceLabel, hasGroups } from "../../src/client/shell/projects/registry-source.js";

const p = (over: Partial<ProjectSummary>): ProjectSummary => ({
  path: "/p", name: "p", current: false, modules: 0, notes: 0, pending: 0, guarded: false, lastActivityMs: 0, emoji: "🚀", ...over,
});

describe("sectionByGroup", () => {
  it("sections by committed group; multi-group appears under each; ungrouped last", () => {
    const projects = [
      p({ name: "a", groups: ["work", "oss"] }),
      p({ name: "b", groups: ["work"] }),
      p({ name: "c" }), // ungrouped
    ];
    const s = sectionByGroup(projects);
    expect(s.map((x) => x.group)).toEqual(["oss", "work", "Ungrouped"]); // alphabetical, Ungrouped last
    expect(s.find((x) => x.group === "work")!.projects.map((x) => x.name)).toEqual(["a", "b"]);
    expect(s.find((x) => x.group === "oss")!.projects.map((x) => x.name)).toEqual(["a"]);
    expect(s.find((x) => x.group === "Ungrouped")!.projects.map((x) => x.name)).toEqual(["c"]);
  });
  it("no groups anywhere → a single Ungrouped section", () => {
    expect(sectionByGroup([p({ name: "x" })])).toEqual([{ group: "Ungrouped", projects: [p({ name: "x" })] }]);
  });
});

describe("source helpers", () => {
  it("isRegistrySource + sourceLabel", () => {
    expect(isRegistrySource("registry")).toBe(true);
    expect(isRegistrySource("recents")).toBe(false);
    expect(isRegistrySource(undefined)).toBe(false);
    expect(sourceLabel("registry")).toBe("your registry");
    expect(sourceLabel("recents")).toBe("recent projects");
  });
  it("hasGroups detects committed group tags", () => {
    expect(hasGroups([p({ groups: ["work"] })])).toBe(true);
    expect(hasGroups([p({}), p({ groups: [] })])).toBe(false);
  });
});

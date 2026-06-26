// P1.3 — the Projects Home table model (filter/sort/group + relative-time).
import { describe, it, expect } from "vitest";
import type { ProjectSummary } from "../../src/shared/index.js";
import {
  filterProjects,
  sortProjects,
  groupProjects,
  projectsView,
  relativeTime,
} from "../../src/client/shell/projects/projects-model.js";

const p = (over: Partial<ProjectSummary>): ProjectSummary => ({
  path: "/p",
  name: "p",
  current: false,
  modules: 0,
  notes: 0,
  pending: 0,
  guarded: false,
  lastActivityMs: 0,
  ...over,
});

const cards = p({ path: "/a/cards-game", name: "cards-game", guarded: true, pending: 2, lastActivityMs: 300 });
const zuzuu = p({ path: "/a/zuzuu", name: "zuzuu", guarded: true, pending: 0, lastActivityMs: 500 });
const blog = p({ path: "/a/blog", name: "blog", guarded: false, pending: 5, lastActivityMs: 100 });
const all = [cards, zuzuu, blog];

describe("filterProjects", () => {
  it("returns everything when the query is blank", () => {
    expect(filterProjects(all, "  ")).toHaveLength(3);
  });
  it("matches name or path, case-insensitively", () => {
    expect(filterProjects(all, "CARDS").map((x) => x.name)).toEqual(["cards-game"]);
    expect(filterProjects(all, "/a/blog").map((x) => x.name)).toEqual(["blog"]);
  });
});

describe("sortProjects", () => {
  it("recent → newest activity first", () => {
    expect(sortProjects(all, "recent").map((x) => x.name)).toEqual(["zuzuu", "cards-game", "blog"]);
  });
  it("name → alphabetical", () => {
    expect(sortProjects(all, "name").map((x) => x.name)).toEqual(["blog", "cards-game", "zuzuu"]);
  });
  it("pending → most pending first, activity tiebreak", () => {
    expect(sortProjects(all, "pending").map((x) => x.name)).toEqual(["blog", "cards-game", "zuzuu"]);
  });
  it("does not mutate its input", () => {
    const input = [...all];
    sortProjects(input, "name");
    expect(input).toEqual(all);
  });
});

describe("groupProjects", () => {
  it("none → a single untitled section", () => {
    const v = groupProjects(all, "none");
    expect(v).toHaveLength(1);
    expect(v[0]!.label).toBe("");
    expect(v[0]!.projects).toHaveLength(3);
  });
  it("guarded → Enabled then Not yet enabled, no empty sections", () => {
    const v = groupProjects(all, "guarded");
    expect(v.map((g) => g.label)).toEqual(["Enabled", "Not yet enabled"]);
    expect(v[0]!.projects.map((x) => x.name)).toEqual(["cards-game", "zuzuu"]);
    expect(v[1]!.projects.map((x) => x.name)).toEqual(["blog"]);
  });
  it("an empty list → no sections", () => {
    expect(groupProjects([], "none")).toEqual([]);
    expect(groupProjects([], "guarded")).toEqual([]);
  });
});

describe("projectsView", () => {
  it("composes filter → sort → group", () => {
    const v = projectsView(all, { search: "", sort: "recent", group: "guarded" });
    expect(v[0]!.projects.map((x) => x.name)).toEqual(["zuzuu", "cards-game"]); // enabled, recent-sorted
  });
});

describe("relativeTime", () => {
  const now = 10_000_000_000;
  it("0 → em dash", () => expect(relativeTime(0, now)).toBe("—"));
  it("under a minute → just now", () => expect(relativeTime(now - 30_000, now)).toBe("just now"));
  it("minutes", () => expect(relativeTime(now - 5 * 60_000, now)).toBe("5m ago"));
  it("hours", () => expect(relativeTime(now - 3 * 3_600_000, now)).toBe("3h ago"));
  it("days", () => expect(relativeTime(now - 2 * 86_400_000, now)).toBe("2d ago"));
  it("months", () => expect(relativeTime(now - 60 * 86_400_000, now)).toBe("2mo ago"));
  it("clamps a future timestamp to just now", () => expect(relativeTime(now + 5000, now)).toBe("just now"));
});

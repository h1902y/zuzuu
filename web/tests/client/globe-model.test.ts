// The global page's pure model (§F): project constellation + the roll-up greeting.
import { describe, it, expect } from "vitest";
import { globeNodes, globalGreeting, projectColor } from "../../src/client/shell/projects/globe-model.js";
import type { ProjectSummary } from "../../src/shared/index.js";

const p = (over: Partial<ProjectSummary>): ProjectSummary => ({
  path: "/x", name: "x", current: false, modules: 1, notes: 0, pending: 0,
  guarded: false, lastActivityMs: 0, emoji: "📦", ...over,
});

describe("globeNodes", () => {
  it("places every project, radius ∝ √notes, biggest near the center", () => {
    const nodes = globeNodes([
      p({ path: "/big", name: "big", notes: 289 }),
      p({ path: "/small", name: "small", notes: 4 }),
    ], { w: 1000, h: 600 });
    expect(nodes).toHaveLength(2);
    const big = nodes.find((n) => n.name === "big")!;
    const small = nodes.find((n) => n.name === "small")!;
    expect(big.r).toBeGreaterThan(small.r);
    // biggest is index 0 → at the spiral center
    expect(Math.hypot(big.x - 500, big.y - 300)).toBeLessThan(Math.hypot(small.x - 500, small.y - 300));
  });

  it("radius is capped so a huge project can't swallow the canvas", () => {
    const [n] = globeNodes([p({ notes: 100000 })], { w: 1000, h: 600 });
    expect(n!.r).toBeLessThanOrEqual(46);
  });

  it("color is stable per path", () => {
    expect(projectColor("/a")).toBe(projectColor("/a"));
    expect(projectColor("/a")).not.toBe(projectColor("/b"));
  });
});

describe("globalGreeting", () => {
  it("rolls up needs-me across projects, most-pending first", () => {
    const g = globalGreeting([
      p({ name: "personal", pending: 2 }),
      p({ name: "wa", pending: 1 }),
      p({ name: "idle", pending: 0 }),
    ], 20);
    expect(g.salutation).toBe("Good evening");
    expect(g.brief).toBe("2 projects need you — 3 to review");
    expect(g.needy.map((n) => n.name)).toEqual(["personal", "wa"]);
  });

  it("all-caught-up when nothing is pending", () => {
    const g = globalGreeting([p({ name: "a" }), p({ name: "b" })], 9);
    expect(g.salutation).toBe("Good morning");
    expect(g.brief).toBe("2 projects · all caught up");
    expect(g.needy).toEqual([]);
  });
});

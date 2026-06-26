// P2.7 — the per-module graph model (wikilink edges + circular layout).
import { describe, it, expect } from "vitest";
import { moduleGraph, circularLayout } from "../../src/client/shell/stage/module-graph.js";

const items = [
  { id: "alpha", title: "Alpha", body: "see [[Beta]] and [[Gamma]]" },
  { id: "beta", title: "Beta", body: "links back to [[alpha]]" },
  { id: "gamma", title: "Gamma", body: "no links; [[Missing]] is unresolved; self [[Gamma]]" },
];

describe("moduleGraph", () => {
  it("nodes mirror the notes", () => {
    expect(moduleGraph(items).nodes).toEqual([
      { id: "alpha", title: "Alpha" }, { id: "beta", title: "Beta" }, { id: "gamma", title: "Gamma" },
    ]);
  });
  it("edges resolve [[wikilinks]] by title or id; drops self + unresolved", () => {
    expect(moduleGraph(items).edges).toEqual([
      { from: "alpha", to: "beta" },
      { from: "alpha", to: "gamma" },
      { from: "beta", to: "alpha" },
    ]);
  });
  it("dedupes repeated references", () => {
    const g = moduleGraph([
      { id: "a", title: "A", body: "[[B]] [[B]] [[b]]" },
      { id: "b", title: "B", body: "" },
    ]);
    expect(g.edges).toEqual([{ from: "a", to: "b" }]);
  });
  it("empty input → empty graph", () => {
    expect(moduleGraph([])).toEqual({ nodes: [], edges: [] });
  });
});

describe("circularLayout", () => {
  it("0 → none, 1 → centre", () => {
    expect(circularLayout(0)).toEqual([]);
    expect(circularLayout(1)).toEqual([{ x: 0, y: 0 }]);
  });
  it("places n points on the unit circle", () => {
    const pts = circularLayout(4);
    expect(pts).toHaveLength(4);
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 6);
  });
});

// P3.1 — the whole-brain graph model (namespaced nodes + cross-module wikilinks).
import { describe, it, expect } from "vitest";
import { brainGraph, splitNodeId } from "../../src/client/shell/graph/brain-graph.js";

const modules = [
  { module: "knowledge", items: [{ id: "auth", title: "Auth", body: "uses [[Session]]" }] },
  { module: "memory", items: [{ id: "session", title: "Session", body: "see [[Auth]] and [[auth]]" }] },
];

describe("brainGraph", () => {
  it("namespaces node ids module:id and tags the module", () => {
    expect(brainGraph(modules).nodes).toEqual([
      { id: "knowledge:auth", title: "Auth", module: "knowledge" },
      { id: "memory:session", title: "Session", module: "memory" },
    ]);
  });
  it("resolves [[wikilinks]] across modules; dedupes", () => {
    expect(brainGraph(modules).edges).toEqual([
      { from: "knowledge:auth", to: "memory:session" },
      { from: "memory:session", to: "knowledge:auth" },
    ]);
  });
  it("empty → empty", () => {
    expect(brainGraph([])).toEqual({ nodes: [], edges: [] });
  });
});

describe("splitNodeId", () => {
  it("splits the namespace back to module + id", () => {
    expect(splitNodeId("knowledge:auth")).toEqual({ module: "knowledge", id: "auth" });
    expect(splitNodeId("knowledge:a:b")).toEqual({ module: "knowledge", id: "a:b" });
    expect(splitNodeId("bare")).toEqual({ module: "", id: "bare" });
  });
});

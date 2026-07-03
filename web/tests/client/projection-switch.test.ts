// The always-there footer projection switcher — the visible twin of T / >map / >table.
import { describe, it, expect } from "vitest";
import { projectionSwitch } from "../../src/client/shell/projection-switch.js";
import type { NavNode } from "../../src/client/shell/shell-state.js";

const table = () => "table" as const;
const map = () => "graph" as const;

describe("projectionSwitch", () => {
  it("World home: Map active, Table opens Everything", () => {
    const s = projectionSwitch(null, table);
    expect(s.active).toBe("map");
    expect(s.map).toEqual({ scope: null, view: "graph" });
    expect(s.table).toEqual({ scope: "", view: "table" });
  });

  it("a module in table view: Table active, both targets stay the module", () => {
    const node: NavNode = { kind: "module", id: "knowledge" };
    const s = projectionSwitch(node, table);
    expect(s.active).toBe("table");
    expect(s.map).toEqual({ scope: "knowledge", view: "graph" });
    expect(s.table).toEqual({ scope: "knowledge", view: "table" });
  });

  it("a module in map view: Map active", () => {
    expect(projectionSwitch({ kind: "module", id: "knowledge" }, map).active).toBe("map");
  });

  it("Everything follows its '' scope view", () => {
    expect(projectionSwitch({ kind: "everything" }, map).active).toBe("map");
    expect(projectionSwitch({ kind: "everything" }, table).active).toBe("table");
    expect(projectionSwitch({ kind: "everything" }, table).map).toEqual({ scope: "", view: "graph" });
  });

  it("a record preserves module context: Map → island, Table → module table", () => {
    const s = projectionSwitch({ kind: "note", id: "brahman", module: "knowledge" }, table);
    expect(s.active).toBeNull();
    expect(s.map).toEqual({ scope: "knowledge", view: "graph" });
    expect(s.table).toEqual({ scope: "knowledge", view: "table" });
  });

  it("a session has no module context: Map → World home, Table → Everything", () => {
    const s = projectionSwitch({ kind: "session", id: "abc" }, table);
    expect(s.active).toBeNull();
    expect(s.map).toEqual({ scope: null, view: "graph" });
    expect(s.table).toEqual({ scope: "", view: "table" });
  });
});

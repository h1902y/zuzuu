// The shared module filter (the lens across BOTH projections) + its map-side
// mirror, spotlightAddrs.
import { describe, expect, it, beforeEach } from "vitest";
import { useModuleFilter, filterOf, isFiltering } from "../../src/client/state/module-filter.js";
import { spotlightAddrs } from "../../src/client/world/model.js";

describe("module-filter store", () => {
  beforeEach(() => useModuleFilter.setState({ byModule: {} }));

  it("defaults to an empty lens; isFiltering is false", () => {
    const f = filterOf(useModuleFilter.getState().byModule, "crm");
    expect(f).toEqual({ text: "", kind: "", module: "", scrollTop: 0 });
    expect(isFiltering(f)).toBe(false);
  });

  it("patch narrows one module; clear resets the lens but keeps the scroll", () => {
    useModuleFilter.getState().patch("crm", { text: "acme", scrollTop: 140 });
    expect(isFiltering(filterOf(useModuleFilter.getState().byModule, "crm"))).toBe(true);
    expect(isFiltering(filterOf(useModuleFilter.getState().byModule, "knowledge"))).toBe(false);
    useModuleFilter.getState().clear("crm");
    const f = filterOf(useModuleFilter.getState().byModule, "crm");
    expect(f.text).toBe("");
    expect(f.scrollTop).toBe(140);
  });
});

describe("spotlightAddrs — the map-side mirror of the module filter", () => {
  const nodes = [
    { addr: "crm:acme", module: "crm", type: "account", title: "Acme Corp", id: "acme" },
    { addr: "crm:globex", module: "crm", type: "account", title: "Globex", id: "globex" },
    { addr: "crm:call-acme", module: "crm", type: "task", title: "", id: "call-acme" },
    { addr: "knowledge:acme-style", module: "knowledge", type: "concept", title: "Acme style", id: "acme-style" },
  ];

  it("text matches title OR id, case-insensitive, scoped to the module", () => {
    expect(spotlightAddrs(nodes, "crm", { text: "ACME", kind: "" }))
      .toEqual(["crm:acme", "crm:call-acme"]);
  });

  it("kind narrows by type; axes compose", () => {
    expect(spotlightAddrs(nodes, "crm", { text: "", kind: "account" }))
      .toEqual(["crm:acme", "crm:globex"]);
    expect(spotlightAddrs(nodes, "crm", { text: "acme", kind: "task" }))
      .toEqual(["crm:call-acme"]);
  });

  it("an empty filter spotlights the whole module (the caller gates on isFiltering)", () => {
    expect(spotlightAddrs(nodes, "crm", { text: "", kind: "" })).toHaveLength(3);
  });
});

// The unified Everything view's pure model: fixed core columns (the envelope
// floor), facet rows, and the toggle-facet mapping.
import { describe, it, expect } from "vitest";
import { EVERYTHING_COLUMNS, moduleFacets, typeFacets, toggleFacet } from "../../src/client/shell/stage/everything-model.js";
import { modulePalette } from "../../src/client/world/model.js";
import type { ModuleItem } from "#shared/index.js";

describe("everything-model — one table over every module", () => {
  it("columns are the cross-module envelope floor (module is a COLUMN)", () => {
    expect(EVERYTHING_COLUMNS.map((c) => c.name)).toEqual(["title", "module", "kind", "status"]);
  });

  it("module facets follow overview order and mark the active one", () => {
    const facets = moduleFacets([{ id: "knowledge" }, { id: "actions" }], "actions");
    expect(facets).toEqual([
      { value: "knowledge", active: false },
      { value: "actions", active: true },
    ]);
  });

  it("type facets are the page's distinct kinds; the active kind survives an empty page", () => {
    const rows = [{ kind: "concept" }, { kind: "concept" }, { kind: "activity" }, { kind: "" }] as ModuleItem[];
    expect(typeFacets(rows, "").map((f) => f.value)).toEqual(["concept", "activity"]);
    // filtered down to a page that no longer carries the active kind → it still shows (clearable)
    expect(typeFacets([{ kind: "concept" }] as ModuleItem[], "activity").map((f) => f.value)).toEqual(["activity", "concept"]);
    expect(typeFacets([] as ModuleItem[], "activity")[0]).toEqual({ value: "activity", active: true });
  });

  it("toggleFacet: clicking the active facet clears it; a new one replaces", () => {
    expect(toggleFacet("", "knowledge")).toBe("knowledge");
    expect(toggleFacet("knowledge", "knowledge")).toBe("");
    expect(toggleFacet("knowledge", "actions")).toBe("actions");
  });

  it("the module dots reuse the world's identity palette (same module, same hue)", () => {
    const p1 = modulePalette(["knowledge", "actions"]);
    const p2 = modulePalette(["actions", "knowledge", "social"]);
    expect(p1["knowledge"]).toBe(p2["knowledge"]); // stable across sets/order
    expect(p1["actions"]).toBe(p2["actions"]);
  });
});

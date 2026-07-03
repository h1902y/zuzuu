// lib/module-details.ts — merging N `GET /module/:key` (ModuleDetail) responses
// into one flat item list + one flat staged list. This is the transform lifted
// out of Search.tsx's / PaletteBody.tsx's queryFn (`.flatMap(d => d.items)` /
// `.flatMap(d => d.staged.map(...))`) after it blanked the "see all results"
// view: a module-detail response arriving without a real `items`/`staged`
// array used to throw mid-fold (`d.staged.map` on `undefined`) inside an
// uncaught React render path. Proves the fold survives every degraded shape.
import { describe, it, expect } from "vitest";
import type { ModuleDetail, ModuleItem } from "#shared/index.js";
import { mergeModuleDetails } from "../../src/client/lib/module-details.js";

const item = (module: string, id: string): ModuleItem =>
  ({ module, id, title: id, kind: "note" }) as ModuleItem;

const detail = (over: Partial<ModuleDetail>): ModuleDetail =>
  ({ key: "m", items: [], staged: [], ...over }) as ModuleDetail;

describe("mergeModuleDetails", () => {
  it("flattens items + staged across well-formed responses", () => {
    const a = detail({ key: "knowledge", items: [item("knowledge", "a")], staged: [{ id: "p1", module: "knowledge", title: "P1" }] });
    const b = detail({ key: "library", items: [item("library", "b")], staged: [] });
    const merged = mergeModuleDetails([a, b]);
    expect(merged.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(merged.staged).toEqual([{ module: "knowledge", s: { id: "p1", module: "knowledge", title: "P1" } }]);
  });

  it("a response with items/staged undefined (the degraded module-detail shape) contributes nothing instead of throwing", () => {
    const good = detail({ key: "knowledge", items: [item("knowledge", "a")], staged: [{ id: "p1", module: "knowledge", title: "P1" }] });
    const broken = { key: "library" } as unknown as ModuleDetail; // items/staged both missing
    expect(() => mergeModuleDetails([good, broken])).not.toThrow();
    const merged = mergeModuleDetails([good, broken]);
    expect(merged.items.map((i) => i.id)).toEqual(["a"]);
    expect(merged.staged).toEqual([{ module: "knowledge", s: { id: "p1", module: "knowledge", title: "P1" } }]);
  });

  it("items/staged present but not arrays (e.g. null) also degrade to nothing, not a throw", () => {
    const broken = { key: "m", items: null, staged: null } as unknown as ModuleDetail;
    expect(() => mergeModuleDetails([broken])).not.toThrow();
    expect(mergeModuleDetails([broken])).toEqual({ items: [], staged: [] });
  });

  it("a null/undefined slot in the fan-out (a settled-but-empty Promise.all entry) is skipped", () => {
    const good = detail({ key: "knowledge", items: [item("knowledge", "a")] });
    expect(mergeModuleDetails([good, null, undefined])).toEqual({
      items: [item("knowledge", "a")],
      staged: [],
    });
  });

  it("an empty fan-out → empty result", () => {
    expect(mergeModuleDetails([])).toEqual({ items: [], staged: [] });
  });
});

// U5 logic — grid column derivation (typed fields vs schemaless inference) + cells.
import { describe, it, expect } from "vitest";
import { gridColumns, inferKeys, cellValue } from "../../src/client/shell/stage/grid-columns.js";
import type { ModuleItem } from "#shared/index.js";

const item = (over: Partial<ModuleItem>): ModuleItem =>
  ({ id: "x", module: "knowledge", kind: "knowledge", title: "X", status: "active", body: "", ...over });

describe("gridColumns", () => {
  it("declared fields → typed columns with labels + align from the registry", () => {
    const cols = gridColumns([{ name: "title", type: "text" }, { name: "score", type: "number" }], []);
    expect(cols.map((c) => c.name)).toEqual(["title", "score"]);
    expect(cols.find((c) => c.name === "score")!.align).toBe("right"); // number is right-aligned
    expect(cols.find((c) => c.name === "title")!.label).toBe("Title");
  });

  it("schemaless → inferred from the union of note keys (module + body excluded)", () => {
    const items = [item({ id: "a", title: "A" }), item({ id: "b", title: "B", status: "archived" })];
    const cols = gridColumns([], items);
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("title");
    expect(names).toContain("status");
    expect(names).not.toContain("module");
    expect(names).not.toContain("body");
  });

  it("a CUSTOM frontmatter column surfaces as a grid column (lossless read projection)", () => {
    // once the read path carries the full envelope, inferKeys unions the custom keys.
    const items = [item({ id: "a", ...({ priority: "high", owner: "alice" } as Partial<ModuleItem>) })];
    const names = inferKeys(items);
    expect(names).toContain("priority");
    expect(names).toContain("owner");
  });

  it("inferKeys snake/kebab → title-cased labels; empty items → no columns", () => {
    expect(gridColumns([{ name: "created_at", type: "date" }], []).find((c) => c.name === "created_at")!.label).toBe("Created At");
    expect(gridColumns([], []).length).toBe(0);
  });

  it("cellValue formats via the FieldType registry", () => {
    const col = gridColumns([{ name: "title", type: "text" }], [])[0]!;
    expect(cellValue(item({ title: "Hi" }), col)).toBe("Hi");
  });
});

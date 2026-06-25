// U10 — the FieldType registry: one map drives the grid cell (format) + the form
// input (parse). Pure logic, tested directly.
import { describe, it, expect } from "vitest";
import { fieldConfig, FIELD_REGISTRY, columnsFor } from "../../src/client/data/field-registry.js";

describe("FieldType registry — format (cell) + parse (input)", () => {
  it("number: right-aligned, formats + parses numerically", () => {
    const f = fieldConfig("number");
    expect(f.align).toBe("right");
    expect(f.format(3)).toBe("3");
    expect(f.format(null)).toBe("");
    expect(f.parse("42")).toBe(42);
    expect(f.parse("nope")).toBeNull();
  });

  it("multi: joins for the cell, splits for the input", () => {
    const f = fieldConfig("multi");
    expect(f.format(["a", "b"])).toBe("a, b");
    expect(f.parse("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("bool + longtext", () => {
    expect(fieldConfig("bool").format(true)).toBe("✓");
    expect(fieldConfig("bool").parse("✓")).toBe(true);
    expect(fieldConfig("longtext").multiline).toBe(true);
  });

  it("an unknown type falls back to text (never crashes)", () => {
    expect(fieldConfig("nonsense")).toBe(FIELD_REGISTRY.text);
  });

  it("columnsFor: declared fields win; schemaless infers text columns from keys", () => {
    expect(columnsFor([{ name: "title", type: "text" }]).map((c) => c.name)).toEqual(["title"]);
    const inferred = columnsFor([], ["title", "kind"]);
    expect(inferred.map((c) => c.name)).toEqual(["title", "kind"]);
    expect(inferred.every((c) => c.type === "text")).toBe(true);
  });
});

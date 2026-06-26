// P2.3 — the shared property model for the record read-view + edit form.
import { describe, it, expect } from "vitest";
import type { ModuleItem } from "../../src/shared/index.js";
import type { FieldDef } from "../../src/client/data/field-registry.js";
import { propertyStack, editableFieldDefs } from "../../src/client/shell/stage/property-stack.js";

const item = {
  id: "n1", module: "knowledge", kind: "fact", title: "T", status: "active", body: "the body",
  weight: 3, tags: ["a", "b"], note: "hi", done: true, blank: "",
  provenance: [{ a: "1" }], payload: { x: 1 },
} as unknown as ModuleItem;

const fields: FieldDef[] = [
  { name: "weight", type: "number", label: "Weight" },
  { name: "tags", type: "multi" },
  { name: "done", type: "bool" },
];

describe("propertyStack", () => {
  it("declared fields first (typed), then inferred scalars; header/objects/empties dropped", () => {
    const props = propertyStack(item, fields);
    expect(props).toEqual([
      { name: "weight", label: "Weight", type: "number", value: "3" },
      { name: "tags", label: "tags", type: "multi", value: "a, b" },
      { name: "done", label: "done", type: "bool", value: "✓" },
      { name: "note", label: "note", type: "text", value: "hi" },
    ]);
  });
  it("schemaless → inferred scalar props only (arrays/objects/empties dropped)", () => {
    const names = propertyStack(item, []).map((p) => p.name);
    expect(names).toEqual(["weight", "note", "done"]); // tags is an array → dropped without a declared type
  });
});

describe("editableFieldDefs", () => {
  it("declared fields, then other scalars, then body last", () => {
    const defs = editableFieldDefs(item, fields);
    expect(defs.map((d) => d.name)).toEqual(["weight", "tags", "done", "note", "blank", "body"]);
    expect(defs.at(-1)).toEqual({ name: "body", type: "longtext" });
    expect(defs[0]).toEqual({ name: "weight", type: "number", label: "Weight" }); // typed, not coerced
  });
  it("never duplicates a declared field that also appears as a key", () => {
    const defs = editableFieldDefs(item, [{ name: "note", type: "longtext" }]);
    expect(defs.filter((d) => d.name === "note")).toHaveLength(1);
    expect(defs.find((d) => d.name === "note")!.type).toBe("longtext"); // declared type wins
  });
});

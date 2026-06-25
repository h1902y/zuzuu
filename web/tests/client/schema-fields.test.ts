// P2.2 — the declared-schema extractor for the schema-aware grid.
import { describe, it, expect } from "vitest";
import { fieldsFromSchema } from "../../src/client/shell/stage/schema-fields.js";

describe("fieldsFromSchema", () => {
  it("pulls declared fields from the CLI's { key, fields } schema", () => {
    const schema = { key: "knowledge", fields: [{ name: "title", type: "text" }, { name: "weight", type: "number", label: "Weight", required: true }] };
    expect(fieldsFromSchema(schema)).toEqual([
      { name: "title", type: "text" },
      { name: "weight", type: "number", label: "Weight", required: true },
    ]);
  });
  it("coerces unknown/absent types to text", () => {
    expect(fieldsFromSchema({ fields: [{ name: "x", type: "wat" }, { name: "y" }] })).toEqual([
      { name: "x", type: "text" },
      { name: "y", type: "text" },
    ]);
  });
  it("skips malformed entries (no name)", () => {
    expect(fieldsFromSchema({ fields: [{ type: "text" }, null, { name: "ok", type: "date" }] })).toEqual([
      { name: "ok", type: "date" },
    ]);
  });
  it("a non-fields schema → [] (schemaless fallback)", () => {
    expect(fieldsFromSchema(null)).toEqual([]);
    expect(fieldsFromSchema({ type: "object", properties: {} })).toEqual([]);
    expect(fieldsFromSchema(undefined)).toEqual([]);
  });
});

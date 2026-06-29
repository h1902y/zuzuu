// U5 logic — grid column derivation (typed fields vs schemaless inference) + cells.
import { describe, it, expect } from "vitest";
import { gridColumns, inferKeys, cellValue, cellDescriptor, describeCell, statusTone } from "../../src/client/shell/stage/grid-columns.js";
import type { GridColumn } from "../../src/client/shell/stage/grid-columns.js";
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

describe("cellDescriptor (typed cells)", () => {
  const col = (name: string, type = "text"): GridColumn => ({ name, label: name, type, align: "left" });

  it("declared FieldType wins: select → pill, multi → pills, bool → bool, number → mono, link → pill", () => {
    expect(cellDescriptor(item({ ...({ s: "open" } as object) }), col("s", "select"))).toMatchObject({ kind: "pill", value: "open" });
    expect(cellDescriptor(item({ ...({ tags: ["a", "b"] } as object) }), col("tags", "multi"))).toEqual({ kind: "pills", values: ["a", "b"] });
    expect(cellDescriptor(item({ ...({ on: true } as object) }), col("on", "bool"))).toEqual({ kind: "bool", value: true });
    expect(cellDescriptor(item({ ...({ n: 42 } as object) }), col("n", "number"))).toEqual({ kind: "mono", value: "42" });
    expect(cellDescriptor(item({ ...({ ref: "deck-index" } as object) }), col("ref", "link"))).toEqual({ kind: "pill", value: "deck-index", tone: "neutral" });
  });

  it("schemaless domain columns read typed: id → mono, kind → module-hue pill, action/status → status pill", () => {
    expect(cellDescriptor(item({ id: "no-root-wipe" }), col("id"))).toEqual({ kind: "mono", value: "no-root-wipe" });
    expect(cellDescriptor(item({ kind: "rule" }), col("kind"))).toEqual({ kind: "pill", value: "rule", tone: "guardrails" });
    expect(cellDescriptor(item({ ...({ action: "deny" } as object) }), col("action"))).toEqual({ kind: "pill", value: "deny", tone: "danger" });
    expect(cellDescriptor(item({ status: "active" }), col("status"))).toEqual({ kind: "pill", value: "active", tone: "success" });
  });

  it("plain text otherwise; empty/null → empty", () => {
    expect(cellDescriptor(item({ title: "Hello" }), col("title"))).toEqual({ kind: "text", value: "Hello" });
    expect(cellDescriptor(item({ ...({ note: "" } as object) }), col("note"))).toEqual({ kind: "empty" });
  });

  it("describeCell is the shared core (the record read-view entry point) — by raw value", () => {
    expect(describeCell("deny", "action", "text")).toEqual({ kind: "pill", value: "deny", tone: "danger" });
    expect(describeCell(["a", "b"], "tags", "multi")).toEqual({ kind: "pills", values: ["a", "b"] });
    expect(describeCell(3, "weight", "number")).toEqual({ kind: "mono", value: "3" });
    expect(describeCell("", "note", "text")).toEqual({ kind: "empty" });
  });

  it("statusTone maps the closed vocabularies", () => {
    expect(statusTone("ask")).toBe("warning");
    expect(statusTone("allow")).toBe("success");
    expect(statusTone("deny")).toBe("danger");
    expect(statusTone("whatever")).toBe("neutral");
  });
});

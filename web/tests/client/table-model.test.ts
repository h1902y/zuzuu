// §H's pure table model: chip derivation (§H.2), the filter grammar's parser
// (§H.3.1), lifecycle tone, and the identity/Attributes column shape.
import { describe, it, expect } from "vitest";
import {
  chipValue,
  attrChips,
  visibleChips,
  chipClause,
  lifecycleTone,
  parseInputClause,
  clauseParts,
  tableColumns,
  IDENTITY_COL,
  ATTRS_COL,
} from "../../src/client/shell/stage/table-model.js";
import type { ModuleItem } from "#shared/index.js";
import type { GridColumn } from "../../src/client/shell/stage/grid-columns.js";

const item = (over: Partial<ModuleItem> = {}): ModuleItem =>
  ({ id: "acme", module: "crm", kind: "account", title: "Acme", status: "active", body: "", ...over } as ModuleItem);

describe("chipValue — a short honest display form", () => {
  it("collapses arrays to a preview + count", () => {
    expect(chipValue(["a", "b"])).toBe("a, b");
    expect(chipValue(["a", "b", "c", "d"])).toBe("a, b +2");
  });
  it("collapses objects to a quiet placeholder (never [object Object])", () => {
    expect(chipValue({ a: 1 })).toBe("{…}");
  });
  it("truncates long scalars; null/undefined are empty", () => {
    expect(chipValue(null)).toBe("");
    expect(chipValue(undefined)).toBe("");
    expect(chipValue("x".repeat(50)).endsWith("…")).toBe(true);
  });
});

describe("attrChips — the row's remaining frontmatter (§H.2)", () => {
  it("skips floor/structural keys and already-shown columns", () => {
    const row = item({ platform: "x", tier: 2 } as unknown as Partial<ModuleItem>);
    const shown: GridColumn[] = [{ name: "tier", label: "Tier", type: "number", align: "right" }];
    const chips = attrChips(row, shown);
    expect(chips.map((c) => c.key)).toEqual(["platform"]);
  });
  it("drops null/empty values — no chip is ever blank", () => {
    const row = item({ platform: "", nickname: null } as unknown as Partial<ModuleItem>);
    expect(attrChips(row, [])).toEqual([]);
  });
});

describe("visibleChips — 2-3 shown + '+N'", () => {
  it("caps at max and reports the overflow count", () => {
    const chips = [1, 2, 3, 4, 5].map((n) => ({ key: `k${n}`, value: String(n) }));
    const { shown, more } = visibleChips(chips, 3);
    expect(shown).toHaveLength(3);
    expect(more).toBe(2);
  });
  it("more is never negative when under the cap", () => {
    expect(visibleChips([{ key: "a", value: "1" }], 3).more).toBe(0);
  });
});

describe("chipClause — a clicked chip becomes a filter clause", () => {
  it("scalar values become key=value", () => {
    const row = item({ platform: "x" } as unknown as Partial<ModuleItem>);
    expect(chipClause(row, "platform")).toBe("platform=x");
  });
  it("object/array/null values have no honest clause", () => {
    const row = item({ tags: ["a", "b"], extra: { a: 1 }, missing: null } as unknown as Partial<ModuleItem>);
    expect(chipClause(row, "tags")).toBeNull();
    expect(chipClause(row, "extra")).toBeNull();
    expect(chipClause(row, "missing")).toBeNull();
  });
});

describe("lifecycleTone — fixed semantic hues (§H.4.4)", () => {
  it("recognizes the four lifecycle states, case-insensitively", () => {
    expect(lifecycleTone("active")).toBe("active");
    expect(lifecycleTone("ACTIVE")).toBe("active");
    expect(lifecycleTone("seed")).toBe("seed");
    expect(lifecycleTone("archived")).toBe("archived");
    expect(lifecycleTone("deprecated")).toBe("deprecated");
  });
  it("anything else (or absent) is null — a neutral pill", () => {
    expect(lifecycleTone("draft")).toBeNull();
    expect(lifecycleTone(undefined)).toBeNull();
  });
});

describe("parseInputClause — one line, three clause kinds (§H.3.1)", () => {
  it("#tag → a tag where clause", () => {
    expect(parseInputClause("#urgent")).toEqual({ kind: "where", clause: "tag=urgent" });
  });
  it("key<op>value → a where clause (longest op wins: >= before >)", () => {
    expect(parseInputClause("tier>=2")).toEqual({ kind: "where", clause: "tier>=2" });
    expect(parseInputClause("status=active")).toEqual({ kind: "where", clause: "status=active" });
    expect(parseInputClause("start_date<=2026-07-02")).toEqual({ kind: "where", clause: "start_date<=2026-07-02" });
  });
  it("a malformed key<op> shape falls back to plain text", () => {
    expect(parseInputClause("=active")).toEqual({ kind: "text", text: "=active" });
  });
  it("anything else is FTS free text", () => {
    expect(parseInputClause("brahman")).toEqual({ kind: "text", text: "brahman" });
  });
  it("blank input is null (nothing to submit)", () => {
    expect(parseInputClause("   ")).toBeNull();
  });
});

describe("clauseParts — splitting a where clause back for chip display", () => {
  it("splits on the first recognized operator", () => {
    expect(clauseParts("tier>=2")).toEqual({ key: "tier", op: ">=", value: "2" });
    expect(clauseParts("status=active")).toEqual({ key: "status", op: "=", value: "active" });
  });
  it("no recognized operator → the whole clause as the key, empty op/value", () => {
    expect(clauseParts("nonsense")).toEqual({ key: "nonsense", op: "", value: "" });
  });
});

describe("tableColumns — identity-first + the elastic Attributes cell (§H.2)", () => {
  it("prepends __identity and appends __attrs, dropping raw id/title columns", () => {
    const cols: GridColumn[] = [
      { name: "id", label: "Id", type: "text", align: "left" },
      { name: "title", label: "Title", type: "text", align: "left" },
      { name: "tier", label: "Tier", type: "number", align: "right" },
    ];
    const out = tableColumns(cols);
    expect(out[0]).toBe(IDENTITY_COL);
    expect(out.at(-1)).toBe(ATTRS_COL);
    expect(out.map((c) => c.name)).toEqual(["__identity", "tier", "__attrs"]);
  });
  it("attrs: false omits the trailing Attributes column", () => {
    const out = tableColumns([{ name: "tier", label: "Tier", type: "number", align: "right" }], { attrs: false });
    expect(out.map((c) => c.name)).toEqual(["__identity", "tier"]);
  });
});

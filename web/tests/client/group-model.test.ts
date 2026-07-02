// §H.3.3/§H.4.6 — client-side group-by + Σ aggregates over the loaded page.
import { describe, it, expect } from "vitest";
import { groupRows, totalSums } from "../../src/client/shell/stage/group-model.js";
import type { ModuleItem } from "#shared/index.js";
import type { GridColumn } from "../../src/client/shell/stage/grid-columns.js";

const COLS: GridColumn[] = [
  { name: "status", label: "Status", type: "text", align: "left" },
  { name: "duration_days", label: "Duration", type: "number", align: "right" },
];

const item = (over: Partial<ModuleItem> = {}): ModuleItem =>
  ({ id: "x", module: "actions", kind: "activity", title: "X", status: "active", body: "", ...over } as ModuleItem);

describe("groupRows — partition by a column's value, first-appearance order", () => {
  it("groups rows and sums number columns per group", () => {
    const rows = [
      item({ id: "a", status: "active", duration_days: 3 } as unknown as Partial<ModuleItem>),
      item({ id: "b", status: "done", duration_days: 5 } as unknown as Partial<ModuleItem>),
      item({ id: "c", status: "active", duration_days: 4 } as unknown as Partial<ModuleItem>),
    ];
    const groups = groupRows(rows, "status", COLS);
    expect(groups.map((g) => g.value)).toEqual(["active", "done"]);
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(groups[0]!.sums).toEqual({ duration_days: 7 });
    expect(groups[1]!.sums).toEqual({ duration_days: 5 });
  });

  it("blank/missing values group under '—'", () => {
    const rows = [item({ id: "a", status: "" } as unknown as Partial<ModuleItem>)];
    const groups = groupRows(rows, "status", COLS);
    expect(groups[0]!.value).toBe("—");
  });

  it("a group with no numeric data reports no sum (never a false 0)", () => {
    const rows = [item({ id: "a", status: "active", duration_days: undefined } as unknown as Partial<ModuleItem>)];
    expect(groupRows(rows, "status", COLS)[0]!.sums).toEqual({});
  });
});

describe("totalSums — the footer's grand-total Σ", () => {
  it("sums every number column across all rows", () => {
    const rows = [
      item({ id: "a", duration_days: 3 } as unknown as Partial<ModuleItem>),
      item({ id: "b", duration_days: 5 } as unknown as Partial<ModuleItem>),
    ];
    expect(totalSums(rows, COLS)).toEqual({ duration_days: 8 });
  });

  it("no number columns ⇒ no sums", () => {
    expect(totalSums([item()], [{ name: "title", label: "Title", type: "text", align: "left" }])).toEqual({});
  });
});

// §H.3.4 — client-side CSV export for a table selection.
import { describe, it, expect } from "vitest";
import { selectionToCsv } from "../../src/client/state/selection-csv.js";
import type { ModuleItem } from "#shared/index.js";

const item = (over: Partial<ModuleItem> = {}): ModuleItem =>
  ({ id: "acme", module: "crm", kind: "account", title: "Acme", status: "active", body: "long take…", ...over } as ModuleItem);

describe("selectionToCsv", () => {
  it("floor columns first, then the union of extra keys, alphabetical", () => {
    const rows = [
      item({ id: "a", tier: 2 } as unknown as Partial<ModuleItem>),
      item({ id: "b", platform: "x" } as unknown as Partial<ModuleItem>),
    ];
    const csv = selectionToCsv(rows);
    const [header] = csv.split("\n");
    expect(header).toBe("id,module,kind,title,status,platform,tier");
  });

  it("excludes body/payload (the record view's job, not the export's)", () => {
    const csv = selectionToCsv([item()]);
    expect(csv).not.toContain("long take");
  });

  it("quotes cells carrying commas/quotes/newlines (RFC 4180)", () => {
    const csv = selectionToCsv([item({ title: 'a, "b"' } as unknown as Partial<ModuleItem>)]);
    expect(csv).toContain('"a, ""b"""');
  });

  it("collapses object/array values via the same short-form the Attributes chips use", () => {
    const csv = selectionToCsv([item({ tags: ["x", "y"] } as unknown as Partial<ModuleItem>)]);
    const rows = csv.split("\n");
    expect(rows[1]).toContain("x, y");
    expect(csv).not.toContain("[object Object]");
  });

  it("a single row with only floor fields still produces a valid two-line CSV", () => {
    const csv = selectionToCsv([item()]);
    expect(csv.split("\n")).toEqual(["id,module,kind,title,status", "acme,crm,account,Acme,active"]);
  });
});

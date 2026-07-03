// §H.6/§H.5: the schema-card refresh — a declared field's `description` rides
// into the note document's schema group alongside its `computed` formula.
import { describe, it, expect } from "vitest";
import { noteGroups } from "../../src/client/note/note-document-model.js";
import type { FieldDef } from "../../src/client/data/field-registry.js";
import type { ModuleItem } from "#shared/index.js";

const item = (over: Partial<ModuleItem> = {}): ModuleItem =>
  ({ id: "acme", module: "crm", kind: "account", title: "Acme", status: "active", body: "", ...over } as ModuleItem);

describe("noteGroups — the schema attribute rows carry description + ƒ formula (§H.5 schema card)", () => {
  it("a field's description rides on its AttrRow", () => {
    const fields: FieldDef[] = [{ name: "tier", type: "number", label: "Tier", description: "priority tier, 1 is highest" }];
    const row = noteGroups(item({ tier: 3 } as unknown as Partial<ModuleItem>), fields).schema[0]!;
    expect(row).toMatchObject({ key: "tier", label: "Tier", value: "3", description: "priority tier, 1 is highest" });
  });
  it("a computed field's formula still renders, alongside its description when present", () => {
    const fields: FieldDef[] = [{ name: "end_date", type: "date", computed: "dateAdd(start_date,duration_days)", description: "derived, never stored" }];
    const row = noteGroups(item({ end_date: "2026-07-05" } as unknown as Partial<ModuleItem>), fields).schema[0]!;
    expect(row.formula).toBe("ƒ dateAdd(start_date,duration_days)");
    expect(row.description).toBe("derived, never stored");
  });
  it("no description on the field → the row carries none (no invented tooltip)", () => {
    const fields: FieldDef[] = [{ name: "owner", type: "text" }];
    const row = noteGroups(item({ owner: "alice" } as unknown as Partial<ModuleItem>), fields).schema[0]!;
    expect(row.description).toBeUndefined();
  });
});

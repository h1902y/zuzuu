// audit item 3 — the New-note draft model: never stage an unapprovable proposal.
import { describe, it, expect } from "vitest";
import { draftProblems, draftChange, DRAFT_ID } from "../../src/client/shell/wing/draft-model.js";
import type { FieldDef } from "../../src/client/data/field-registry.js";

const FIELDS: FieldDef[] = [
  { name: "company", type: "text", required: true },
  { name: "tier", type: "number" },
  { name: "stage", type: "select", options: ["lead", "won"], label: "Deal stage", required: true },
];

describe("draftProblems", () => {
  it("blocks until id, type, and every required column are present", () => {
    expect(draftProblems(FIELDS, {}, "", "")).toContain("an id is required");
    expect(draftProblems(FIELDS, {}, "acme", "")).toContain("a type is required");
    const missing = draftProblems(FIELDS, { company: "Acme" }, "acme", "account");
    expect(missing).toEqual(["'Deal stage' is required"]);
    expect(draftProblems(FIELDS, { company: "Acme", stage: "lead" }, "acme", "account")).toEqual([]);
  });
  it("rejects non-slug ids (matches the CLI's discipline)", () => {
    expect(draftProblems([], {}, "Not A Slug!", "note")[0]).toMatch(/slug/);
    expect(DRAFT_ID.test("valid-slug.v2")).toBe(true);
  });
  it("blank optional fields are fine", () => {
    expect(draftProblems([{ name: "notes", type: "text" }], {}, "x", "note")).toEqual([]);
  });
});

describe("draftChange", () => {
  it("carries type + parsed non-empty fields only", () => {
    const change = draftChange(FIELDS, { company: "Acme", tier: "3", stage: "lead" }, "account",
      (f, raw) => (f.type === "number" ? Number(raw) : raw));
    expect(change).toEqual({ type: "account", company: "Acme", tier: 3, stage: "lead" });
  });
  it("skips empty values (a blank optional column never lands as '')", () => {
    const change = draftChange(FIELDS, { company: "Acme", tier: " " }, "account", (_f, raw) => raw);
    expect(change).toEqual({ type: "account", company: "Acme" });
  });
});

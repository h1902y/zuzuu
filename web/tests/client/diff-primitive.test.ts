// U3 — the promoted Diff primitive's model (ds/kit/Diff.tsx + ds/lib/diff.ts).
// Framework-free: pure model tests, no DOM (the project's convention — see
// diff.test.ts / proposal-state.test.ts). The LCS engine itself (lineDiff/changeText/
// isUpdate) is untouched and stays covered by diff.test.ts; this file proves (a) the
// ds re-export resolves to the SAME engine (no silent fork/regression) and (b) the
// NEW field-level + combined-collapse model this promotion adds.
import { describe, it, expect } from "vitest";
import {
  lineDiff, changeText, isUpdate, fieldDiff, combinedDiff, COLLAPSE_AT,
} from "../../src/client/ds/lib/diff.js";
import * as engine from "../../src/client/shell/review/diff.js";

describe("ds/lib/diff — the LCS engine is re-exported, not forked (U3 promotion)", () => {
  it("lineDiff/changeText/isUpdate resolve to the SAME functions as shell/review/diff.ts", () => {
    expect(lineDiff).toBe(engine.lineDiff);
    expect(changeText).toBe(engine.changeText);
    expect(isUpdate).toBe(engine.isUpdate);
  });

  it("body LCS output is unchanged vs today — the same regression shapes diff.test.ts pins", () => {
    expect(lineDiff("", "line one\nline two").map((r) => r.tag)).toEqual(["added", "added"]);
    expect(lineDiff("a\nb\nc", "a\nb\nc").every((r) => r.tag === "unchanged")).toBe(true);
    expect(lineDiff("", "")).toEqual([]);
    expect(lineDiff("a\nold\nc", "a\nnew\nc").map((r) => `${r.tag}:${r.text}`)).toEqual([
      "unchanged:a", "removed:old", "added:new", "unchanged:c",
    ]);
  });
});

describe("fieldDiff — frontmatter field maps, current note vs staged change (KTD3, client-side)", () => {
  it("one row per CHANGED field; a field the change proposes the SAME value for produces no row", () => {
    const current = { id: "n1", module: "knowledge", kind: "fact", title: "Old title", status: "active", priority: "low", body: "…" };
    const change = { title: "New title", priority: "low", status: "archived" };
    const rows = fieldDiff(current, change);
    expect(rows.map((r) => r.field).sort()).toEqual(["status", "title"]);
    expect(rows.find((r) => r.field === "title")).toEqual({ field: "title", before: "Old title", after: "New title" });
    expect(rows.find((r) => r.field === "status")).toEqual({ field: "status", before: "active", after: "archived" });
  });

  it("a field on the current note but ABSENT from the change is never diffed (a staged update is a merge-patch — mergeEdit only touches keys the change carries)", () => {
    const current = { id: "n1", url: "https://old" };
    const rows = fieldDiff(current, { title: "t" });
    expect(rows.some((r) => r.field === "url")).toBe(false);
  });

  it("a new field with no prior value shows before: ''", () => {
    expect(fieldDiff({ id: "n1" }, { owner: "alice" })).toEqual([{ field: "owner", before: "", after: "alice" }]);
  });

  it("body/id/module/provenance/source/payload never surface as field rows themselves (structural, not reviewable content)", () => {
    const current = { id: "n1", module: "knowledge", body: "old body", provenance: [{ x: 1 }], source: { producer: "observe" }, payload: { a: 1 } };
    const change = { body: "new body", id: "n1", module: "knowledge", provenance: [{ x: 2 }], source: { producer: "hand" }, payload: { a: 2 } };
    expect(fieldDiff(current, change)).toEqual([]);
  });

  it("a legacy/defensive `change.attributes` shape folds its OWN sub-keys in as fields (mirrors the daemon's changeText/stagedPreview tolerance) — the wrapper key itself never surfaces", () => {
    const rows = fieldDiff({ id: "n1" }, { attributes: { pattern: "rm -rf dist" } });
    expect(rows).toEqual([{ field: "pattern", before: "", after: "rm -rf dist" }]);
    expect(rows.some((r) => r.field === "attributes")).toBe(false);
  });

  it("kind (the current note's name for it) compares against type (the change's name for it)", () => {
    expect(fieldDiff({ id: "n1", kind: "fact" }, { type: "insight" }))
      .toEqual([{ field: "type", before: "fact", after: "insight" }]);
  });

  it("array values format joined (mirrors the grid's `multi` FieldType), never '[object Object]'", () => {
    expect(fieldDiff({ tags: ["a", "b"] }, { tags: ["a", "c"] }))
      .toEqual([{ field: "tags", before: "a, b", after: "a, c" }]);
  });

  it("an odd/missing change shape degrades to no rows rather than throwing — the honest fallback (body LCS still renders independently, see combinedDiff below)", () => {
    expect(fieldDiff(undefined, undefined)).toEqual([]);
    expect(fieldDiff({ id: "n1" }, undefined)).toEqual([]);
    expect(fieldDiff({ id: "n1" }, "nonsense" as unknown as Record<string, unknown>)).toEqual([]);
    expect(fieldDiff("nonsense" as unknown as Record<string, unknown>, { title: "t" }))
      .toEqual([{ field: "title", before: "", after: "t" }]);
  });
});

describe("combinedDiff — field rows (update only) + the LCS body diff, ONE collapse rule (U3)", () => {
  it("a create shows all-added: no field rows, body all-added", () => {
    const d = combinedDiff({ update: false, change: { type: "knowledge", body: "line one\nline two" }, beforeBody: "" });
    expect(d.fieldRows).toEqual([]);
    expect(d.bodyRows.map((r) => r.tag)).toEqual(["added", "added"]);
    expect(d.total).toBe(2);
  });

  it("an update with ONLY a body change: no field rows, the body diff is present", () => {
    const current = { id: "n1", title: "Same title", body: "old body" };
    const d = combinedDiff({ update: true, current, change: { body: "new body" }, beforeBody: "old body" });
    expect(d.fieldRows).toEqual([]);
    expect(d.bodyRows.length).toBeGreaterThan(0);
  });

  it("an update with ONLY field changes: field rows present, NO body diff (the patch never touched body — a merge-patch update, not a full replacement)", () => {
    const current = { id: "n1", title: "Old", body: "unchanged body text" };
    const d = combinedDiff({ update: true, current, change: { title: "New" }, beforeBody: "unchanged body text" });
    expect(d.fieldRows).toEqual([{ field: "title", before: "Old", after: "New" }]);
    expect(d.bodyRows).toEqual([]);
  });

  it("an update that changes neither field nor body → nothing to review", () => {
    const current = { id: "n1", title: "Same", body: "same body" };
    const d = combinedDiff({ update: true, current, change: { title: "Same" }, beforeBody: "same body" });
    expect(d.total).toBe(0);
    expect(d.collapsed).toBe(false);
  });

  it("an update that changes BOTH fields and body shows both", () => {
    const current = { id: "n1", title: "Old", body: "old body" };
    const d = combinedDiff({ update: true, current, change: { title: "New", body: "new body" }, beforeBody: "old body" });
    expect(d.fieldRows).toEqual([{ field: "title", before: "Old", after: "New" }]);
    expect(d.bodyRows.length).toBeGreaterThan(0);
  });

  it("the collapse-to-modal rule (combined rows > COLLAPSE_AT) is preserved", () => {
    const fields = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i}`, `new${i}`]));
    const current = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i}`, `old${i}`]));
    const longBody = Array.from({ length: 5 }, (_, i) => `line${i}`).join("\n");
    const d = combinedDiff({ update: true, current, change: { ...fields, body: longBody }, beforeBody: "" });
    expect(d.total).toBe(10); // 5 field rows + 5 added body lines
    expect(d.total).toBeGreaterThan(COLLAPSE_AT);
    expect(d.collapsed).toBe(true);
  });

  it("stays inline at exactly COLLAPSE_AT combined rows (the boundary — not collapsed)", () => {
    const body = Array.from({ length: COLLAPSE_AT }, (_, i) => `l${i}`).join("\n");
    const d = combinedDiff({ update: false, change: { body }, beforeBody: "" });
    expect(d.total).toBe(COLLAPSE_AT);
    expect(d.collapsed).toBe(false);
  });

  it("collapses at COLLAPSE_AT + 1 combined rows (one past the boundary)", () => {
    const body = Array.from({ length: COLLAPSE_AT + 1 }, (_, i) => `l${i}`).join("\n");
    const d = combinedDiff({ update: false, change: { body }, beforeBody: "" });
    expect(d.total).toBe(COLLAPSE_AT + 1);
    expect(d.collapsed).toBe(true);
  });
});

// U3 — lineDiff: a pure line-level before/after diff for the proposal preview.
import { describe, it, expect } from "vitest";
import { lineDiff, changeText, isUpdate, type DiffRow } from "../../src/client/shell/review/diff.js";

const tags = (rows: DiffRow[]) => rows.map((r) => r.tag);

describe("lineDiff — line-level before/after", () => {
  it("a create (before === '') → every row is added", () => {
    const rows = lineDiff("", "line one\nline two\nline three");
    expect(tags(rows)).toEqual(["added", "added", "added"]);
    expect(rows.map((r) => r.text)).toEqual(["line one", "line two", "line three"]);
  });

  it("identical bodies → all unchanged (no added/removed)", () => {
    const rows = lineDiff("a\nb\nc", "a\nb\nc");
    expect(tags(rows)).toEqual(["unchanged", "unchanged", "unchanged"]);
    expect(rows.some((r) => r.tag === "added" || r.tag === "removed")).toBe(false);
  });

  it("an empty net diff (both empty) → no rows", () => {
    expect(lineDiff("", "")).toEqual([]);
  });

  it("added lines keep the unchanged anchors aligned", () => {
    const rows = lineDiff("a\nc", "a\nb\nc");
    expect(tags(rows)).toEqual(["unchanged", "added", "unchanged"]);
    expect(rows.find((r) => r.tag === "added")?.text).toBe("b");
  });

  it("removed lines surface as removed, anchors unchanged", () => {
    const rows = lineDiff("a\nb\nc", "a\nc");
    expect(tags(rows)).toEqual(["unchanged", "removed", "unchanged"]);
    expect(rows.find((r) => r.tag === "removed")?.text).toBe("b");
  });

  it("a changed line reads as removed-then-added (not a silent swap)", () => {
    const rows = lineDiff("a\nold\nc", "a\nnew\nc");
    expect(rows.map((r) => `${r.tag}:${r.text}`)).toEqual([
      "unchanged:a",
      "removed:old",
      "added:new",
      "unchanged:c",
    ]);
  });

  it("normalizes CRLF so line endings don't manufacture diffs", () => {
    const rows = lineDiff("a\r\nb", "a\nb");
    expect(tags(rows)).toEqual(["unchanged", "unchanged"]);
  });
});

describe("changeText — the after text that lands", () => {
  it("a knowledge/memory/instruction change → its body", () => {
    expect(changeText({ type: "knowledge", body: "use node:sqlite" })).toBe("use node:sqlite");
  });

  it("an action change → its run command", () => {
    expect(changeText({ type: "action", run: "npm test" })).toBe("npm test");
  });

  it("a guardrail rule → pattern → action", () => {
    expect(changeText({ type: "rule", pattern: "rm -rf dist", action: "ask" })).toBe("rm -rf dist → ask");
  });

  it("a rule with only a pattern → the pattern alone", () => {
    expect(changeText({ type: "rule", pattern: "rm -rf dist" })).toBe("rm -rf dist");
  });

  it("falls back to the title when there is no body/run/pattern", () => {
    expect(changeText({ type: "knowledge", title: "Something" })).toBe("Something");
  });

  it("undefined change → empty string", () => {
    expect(changeText(undefined)).toBe("");
  });
});

describe("isUpdate — only an update has a before", () => {
  it("op:'update' → true", () => {
    expect(isUpdate({ op: "update" })).toBe(true);
  });
  it("op:'create' (the mined default) → false", () => {
    expect(isUpdate({ op: "create" })).toBe(false);
  });
  it("no op → false (after-only)", () => {
    expect(isUpdate({})).toBe(false);
  });
});

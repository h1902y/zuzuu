// P2.1 — the governed stage-header model (selection → header + tab clamp + note id).
import { describe, it, expect } from "vitest";
import { stageHeaderModel, resolveTab, newNoteId } from "../../src/client/shell/stage/stage-header.js";

describe("stageHeaderModel", () => {
  it("overview / home → no governed header", () => {
    expect(stageHeaderModel(null).show).toBe(false);
    expect(stageHeaderModel({ kind: "overview" }).show).toBe(false);
  });
  it("a module → New note primary", () => {
    expect(stageHeaderModel({ kind: "module", id: "knowledge" })).toEqual({ show: true, primary: { key: "new-note", label: "New note" } });
  });
  it("a row → header but no primary (the Form wing is the editor)", () => {
    expect(stageHeaderModel({ kind: "row", id: "n1", module: "knowledge" })).toEqual({ show: true, primary: null });
  });
  it("a session → End session primary (the canonical end affordance)", () => {
    expect(stageHeaderModel({ kind: "session", id: "s1" })).toEqual({ show: true, primary: { key: "end-session", label: "End session" } });
  });
});

describe("resolveTab", () => {
  const tabs = [{ key: "table", label: "Table" }, { key: "graph", label: "Graph" }];
  it("no tabs → undefined", () => expect(resolveTab([], "table")).toBeUndefined());
  it("a valid request passes through", () => expect(resolveTab(tabs, "graph")).toBe("graph"));
  it("an absent/stale request falls back to the first tab", () => {
    expect(resolveTab(tabs, "nope")).toBe("table");
    expect(resolveTab(tabs, undefined)).toBe("table");
  });
});

describe("newNoteId", () => {
  it("is filesystem-safe and seed-derived", () => {
    expect(newNoteId(0)).toBe("note-0");
    expect(newNoteId(123456789)).toMatch(/^note-[0-9a-z]+$/);
  });
});

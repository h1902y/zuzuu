// U2 (live-views plan, docs/plans/2026-07-04-002) — the ViewBoard's pure model.
// Three seams: viewFetchState (delegates to U1's viewQueryToListState), the
// human query-summary line, and the R5 empty/error classifier. No DOM/render
// harness in this suite — ViewBoard.tsx itself is untested here by design.
import { describe, it, expect } from "vitest";
import { viewFetchState, viewQuerySummary, classifyViewBoard, viewBoardCopy } from "../../src/client/shell/stage/view-board-model.js";
import { initialListState } from "../../src/client/data/list-state.js";

describe("viewFetchState — fetch scope + groupBy, delegated to U1", () => {
  it("derives module/where/groupBy straight through a real view note's query", () => {
    const s = viewFetchState({ query: { module: "crm", where: ["stage!=lost"], "group-by": "stage" } }, "fallback");
    expect(s.module).toBe("crm");
    expect(s.where).toEqual(["stage!=lost"]);
    expect(s.groupBy).toBe("stage");
  });

  it("carries kind/status/text/sort through as well (the full ListState, not just groupBy)", () => {
    const s = viewFetchState({ query: { module: "crm", type: "account", status: "active", text: "acme", sort: { key: "tier", dir: "desc" } } }, "fallback");
    expect(s.kind).toBe("account");
    expect(s.status).toBe("active");
    expect(s.text).toBe("acme");
    expect(s.sort).toEqual({ key: "tier", dir: "desc" });
  });

  it("falls back to the caller's module when the query names none", () => {
    expect(viewFetchState({ query: {} }, "crm").module).toBe("crm");
  });

  it("a note with no query at all still resolves to a safe ListState using the fallback — no throw", () => {
    expect(viewFetchState({ query: undefined }, "crm")).toEqual({ ...initialListState, module: "crm" });
  });

  it("a missing note (null/undefined — fetch not resolved / 404) resolves to a safe fallback ListState", () => {
    expect(viewFetchState(null, "crm")).toEqual({ ...initialListState, module: "crm" });
    expect(viewFetchState(undefined, "crm")).toEqual({ ...initialListState, module: "crm" });
  });
});

describe("viewQuerySummary — the board header's human reading of the running query", () => {
  it("renders 'grouped by X · where …' for a grouped + filtered query (the plan's own example)", () => {
    const s = { ...initialListState, groupBy: "stage", where: ["stage!=lost"] };
    expect(viewQuerySummary(s)).toBe("grouped by stage · where stage ≠ lost");
  });

  it("renders a bare summary for an empty query (no axes at all)", () => {
    expect(viewQuerySummary(initialListState)).toBe("all notes, ungrouped");
  });

  it("carries type/status/text/sort in a fixed order alongside group-by + where", () => {
    const s = { ...initialListState, groupBy: "stage", kind: "account", status: "active", where: ["tier>=2"], text: "acme", sort: { key: "tier", dir: "asc" as const } };
    expect(viewQuerySummary(s)).toBe('grouped by stage · type account · status active · where tier ≥ 2 · matching "acme" · sorted by tier asc');
  });

  it("renders every comparison operator's glyph correctly (!=, >=, <= translate; =, >, < pass through)", () => {
    expect(viewQuerySummary({ ...initialListState, where: ["a!=b"] })).toBe("where a ≠ b");
    expect(viewQuerySummary({ ...initialListState, where: ["a>=b"] })).toBe("where a ≥ b");
    expect(viewQuerySummary({ ...initialListState, where: ["a<=b"] })).toBe("where a ≤ b");
    expect(viewQuerySummary({ ...initialListState, where: ["a=b"] })).toBe("where a = b");
    expect(viewQuerySummary({ ...initialListState, where: ["a>b"] })).toBe("where a > b");
    expect(viewQuerySummary({ ...initialListState, where: ["a<b"] })).toBe("where a < b");
  });

  it("multiple where clauses join with a comma inside the one 'where' segment", () => {
    expect(viewQuerySummary({ ...initialListState, where: ["stage!=lost", "tier>=2"] })).toBe("where stage ≠ lost, tier ≥ 2");
  });

  it("an unparseable where clause (no recognized operator) reads back verbatim rather than fabricating a reading", () => {
    expect(viewQuerySummary({ ...initialListState, where: ["not-a-clause"] })).toBe("where not-a-clause");
  });
});

describe("classifyViewBoard — R5's empty/error decision", () => {
  const goodNote = { query: { module: "crm" } };

  it("'ok' for a real note with non-zero rows", () => {
    expect(classifyViewBoard({ note: goodNote, rows: [{ id: "a" }] })).toBe("ok");
  });

  it("'empty' for zero rows against an otherwise valid note", () => {
    expect(classifyViewBoard({ note: goodNote, rows: [] })).toBe("empty");
  });

  it("'ok' for a module absent from any known-modules/manifest list, as long as it has rows — the manifest list is not the source of truth (this is the bug fix: a module with notes but no module.md must still render)", () => {
    expect(classifyViewBoard({ note: goodNote, rows: [{ id: "a" }] })).toBe("ok");
  });

  it("a valid query against a module with zero rows is 'empty', not a false 'module not found' — one honest state covers both a genuinely empty module and a renamed/removed one", () => {
    expect(classifyViewBoard({ note: goodNote, rows: [] })).toBe("empty");
  });

  it("'malformed' when the note itself is absent (fetch failed / 404)", () => {
    expect(classifyViewBoard({ note: null, rows: [] })).toBe("malformed");
    expect(classifyViewBoard({ note: undefined, rows: [] })).toBe("malformed");
  });

  it("'malformed' when `query` isn't a usable object shape (string/number/array/null)", () => {
    for (const bad of ["not-an-object", 42, ["array", "not", "object"], null]) {
      expect(classifyViewBoard({ note: { query: bad }, rows: [] })).toBe("malformed");
    }
  });

  it("an EMPTY-but-valid query object ({}) is NOT malformed — a deliberate, unfiltered view", () => {
    expect(classifyViewBoard({ note: { query: {} }, rows: [] })).toBe("empty");
    expect(classifyViewBoard({ note: { query: {} }, rows: [{ id: "a" }] })).toBe("ok");
  });

  it("malformed wins over rows — no query to even run, regardless of what rows are passed", () => {
    expect(classifyViewBoard({ note: null, rows: [{ id: "a" }] })).toBe("malformed");
  });
});

describe("viewBoardCopy — the EmptyState copy per classifier state", () => {
  it("every non-ok status has a non-empty title + hint", () => {
    for (const status of ["empty", "malformed"] as const) {
      const copy = viewBoardCopy(status, "crm");
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.hint.length).toBeGreaterThan(0);
    }
  });

  it("the empty copy is the honest 'no notes match' message, not a false 'module not found'", () => {
    expect(viewBoardCopy("empty", "deals").title).toBe("No notes match this view");
  });
});

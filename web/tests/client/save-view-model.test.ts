// U5 (live-views plan, docs/plans/2026-07-04-002) — save-as-view's pure model.
// Builds a `type:view` note change from the table's current ListState + a
// title (delegating the query to U1's listStateToViewQuery), validates the
// title, and asserts the empty-query rule explicitly. No DOM/render harness
// (matches draft-model/view-query's own suites) — SaveViewForm.tsx itself is
// untested here by design.
import { describe, it, expect } from "vitest";
import {
  viewNoteId, saveViewProblems, saveViewChange, saveViewPreview, isEmptyQuery,
} from "../../src/client/shell/stage/save-view-model.js";
import { listStateToViewQuery, viewQueryToListState } from "../../src/client/shell/stage/view-query.js";
import { initialListState } from "../../src/client/data/list-state.js";
import type { ListState } from "../../src/client/data/list-state.js";

describe("viewNoteId — title → a slug id", () => {
  it("slugifies a title into a view-prefixed, kebab-case id", () => {
    expect(viewNoteId("Open Pipeline by Stage", 0)).toBe("view-open-pipeline-by-stage");
  });
  it("collapses punctuation/whitespace runs to one hyphen, trims edges", () => {
    expect(viewNoteId("  Q3!! Deals -- Won??  ", 0)).toBe("view-q3-deals-won");
  });
  it("falls back to a seeded id when the title slugifies to nothing", () => {
    expect(viewNoteId("!!!", 42)).toBe(`view-${(42).toString(36)}`);
    expect(viewNoteId("   ", 42)).toBe(`view-${(42).toString(36)}`);
  });
  it("caps an overlong title so the id stays a sane filename", () => {
    const id = viewNoteId("a".repeat(200), 0);
    expect(id.length).toBeLessThanOrEqual(64 + "view-".length);
  });
});

describe("saveViewProblems — title is the ONE gate", () => {
  it("blocks an empty or whitespace-only title", () => {
    expect(saveViewProblems("")).toEqual(["a title is required"]);
    expect(saveViewProblems("   ")).toEqual(["a title is required"]);
  });
  it("a non-empty title is stageable", () => {
    expect(saveViewProblems("Pipeline by stage")).toEqual([]);
  });
});

describe("saveViewChange — builds {type:view, title, query}", () => {
  it("carries where + group-by + sort into the query, matching listStateToViewQuery exactly", () => {
    const state: ListState = { ...initialListState, where: ["stage!=lost"], groupBy: "stage", sort: { key: "tier", dir: "asc" } };
    const change = saveViewChange(state, "crm", "Open pipeline by stage");
    expect(change).toEqual({
      type: "view",
      title: "Open pipeline by stage",
      query: listStateToViewQuery(state, "crm"),
    });
    expect(change.query).toEqual({ module: "crm", where: ["stage!=lost"], "group-by": "stage", sort: { key: "tier", dir: "asc" } });
  });

  it("trims the title", () => {
    const change = saveViewChange(initialListState, "crm", "  Padded title  ");
    expect(change.title).toBe("Padded title");
  });

  it("an untouched ListState (no filter/group/sort) derives a query of just {module} — the empty-query rule", () => {
    const change = saveViewChange(initialListState, "crm", "All CRM rows");
    expect(change).toEqual({ type: "view", title: "All CRM rows", query: { module: "crm" } });
    expect(isEmptyQuery(change.query)).toBe(true);
  });

  it("isEmptyQuery is false once any axis (even just text) is set", () => {
    const state: ListState = { ...initialListState, text: "acme" };
    expect(isEmptyQuery(saveViewChange(state, "crm", "t").query)).toBe(false);
  });
});

describe("saveViewPreview — the read-only query summary", () => {
  it("matches U2's viewQuerySummary for a grouped/filtered state", () => {
    const state: ListState = { ...initialListState, groupBy: "stage", where: ["stage!=lost"] };
    expect(saveViewPreview(state)).toBe("grouped by stage · where stage ≠ lost");
  });
  it("renders the bare fallback for an empty query (still a legal, previewable view)", () => {
    expect(saveViewPreview(initialListState)).toBe("all notes, ungrouped");
  });
});

describe("round-trip: saving the current state then opening the view reproduces the same ListState", () => {
  it("a fully-populated state survives save → open unchanged (module + every query axis)", () => {
    const state: ListState = {
      ...initialListState,
      text: "acme", kind: "account", status: "active",
      where: ["stage!=lost", "tier>=2"], sort: { key: "tier", dir: "desc" }, groupBy: "stage",
    };
    const change = saveViewChange(state, "crm", "Open accounts");
    const reopened = viewQueryToListState(change.query, "fallback");
    const { module, ...reopenedState } = reopened;
    expect(module).toBe("crm");
    expect(reopenedState).toEqual(state);
  });

  it("a bare (empty-query) state round-trips to the same defaults", () => {
    const change = saveViewChange(initialListState, "crm", "All rows");
    const reopened = viewQueryToListState(change.query, "fallback");
    const { module, ...reopenedState } = reopened;
    expect(module).toBe("crm");
    expect(reopenedState).toEqual(initialListState);
  });

  it("a partially-populated state (where + group-by only) round-trips", () => {
    const state: ListState = { ...initialListState, where: ["stage!=lost"], groupBy: "stage" };
    const change = saveViewChange(state, "crm", "Open, grouped");
    const { module, ...reopenedState } = viewQueryToListState(change.query, "fallback");
    expect(module).toBe("crm");
    expect(reopenedState).toEqual(state);
  });
});

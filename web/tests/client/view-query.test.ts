// U1 (live-views plan, docs/plans/2026-07-04-002) — the pure query⇄ListState
// mappers. viewQueryToListState is the open path (a view note's `query` map →
// a fetch-ready ListState); listStateToViewQuery is the inverse save path (the
// table's current ListState → a minimal `query` map). Both total: malformed/
// empty input coerces to safe defaults, never throws.
import { describe, it, expect } from "vitest";
import { viewQueryToListState, listStateToViewQuery } from "../../src/client/shell/stage/view-query.js";
import { initialListState } from "../../src/client/data/list-state.js";
import type { ListState } from "../../src/client/data/list-state.js";

describe("viewQueryToListState — the open path", () => {
  it("maps module/where/group-by straight through", () => {
    const s = viewQueryToListState({ module: "crm", where: ["stage!=lost"], "group-by": "stage" }, "fallback");
    expect(s.module).toBe("crm");
    expect(s.where).toEqual(["stage!=lost"]);
    expect(s.groupBy).toBe("stage");
  });

  it("maps query.type/query.status to kind/status (the name-mismatched axes)", () => {
    const s = viewQueryToListState({ module: "crm", type: "account", status: "active" }, "fallback");
    expect(s.kind).toBe("account");
    expect(s.status).toBe("active");
  });

  it("maps query.text and query.sort straight through", () => {
    const s = viewQueryToListState({ module: "crm", text: "acme", sort: { key: "tier", dir: "desc" } }, "fallback");
    expect(s.text).toBe("acme");
    expect(s.sort).toEqual({ key: "tier", dir: "desc" });
  });

  it("absent fields fall back to ListState defaults", () => {
    const s = viewQueryToListState({ module: "crm" }, "fallback");
    expect(s.text).toBe(initialListState.text);
    expect(s.kind).toBe(initialListState.kind);
    expect(s.status).toBe(initialListState.status);
    expect(s.where).toEqual(initialListState.where);
    expect(s.sort).toBe(initialListState.sort);
    expect(s.groupBy).toBe(initialListState.groupBy);
    expect(s.page).toBe(initialListState.page);
    expect(s.pageSize).toBe(initialListState.pageSize);
  });

  it("falls back to moduleFallback when query.module is absent or empty", () => {
    expect(viewQueryToListState({}, "crm").module).toBe("crm");
    expect(viewQueryToListState({ module: "" }, "crm").module).toBe("crm");
    expect(viewQueryToListState({ module: "  " }, "crm").module).toBe("  "); // whitespace is a non-empty string — honest passthrough, not our call to trim
  });

  it("an empty query ({}) is a safe ListState using the module fallback — no throw", () => {
    const s = viewQueryToListState({}, "crm");
    expect(s).toEqual({ ...initialListState, module: "crm" });
  });

  it("malformed / non-object query shapes never throw — all coerce to the fallback ListState", () => {
    for (const bad of [null, undefined, "not-an-object", 42, ["array", "not", "object"], true]) {
      expect(() => viewQueryToListState(bad, "crm")).not.toThrow();
      expect(viewQueryToListState(bad, "crm")).toEqual({ ...initialListState, module: "crm" });
    }
  });

  it("a where list with non-string entries drops only the bad entries", () => {
    const s = viewQueryToListState({ module: "crm", where: ["stage=won", 42, null, "tier>=2"] }, "fallback");
    expect(s.where).toEqual(["stage=won", "tier>=2"]);
  });

  it("a malformed sort (bad dir, missing key) drops to null rather than a half-shaped object", () => {
    expect(viewQueryToListState({ module: "crm", sort: { key: "tier", dir: "sideways" } }, "fallback").sort).toBeNull();
    expect(viewQueryToListState({ module: "crm", sort: { dir: "asc" } }, "fallback").sort).toBeNull();
    expect(viewQueryToListState({ module: "crm", sort: "title:asc" }, "fallback").sort).toBeNull();
  });

  it("an empty-string group-by falls back to null, not a stored empty group axis", () => {
    expect(viewQueryToListState({ module: "crm", "group-by": "" }, "fallback").groupBy).toBeNull();
  });
});

describe("listStateToViewQuery — the save path (inverse)", () => {
  it("carries where + group-by + sort into the query map", () => {
    const state: ListState = { ...initialListState, where: ["stage!=lost"], groupBy: "stage", sort: { key: "tier", dir: "asc" } };
    expect(listStateToViewQuery(state, "crm")).toEqual({
      module: "crm",
      where: ["stage!=lost"],
      "group-by": "stage",
      sort: { key: "tier", dir: "asc" },
    });
  });

  it("maps kind/groupBy to the query map's type/group-by keys", () => {
    const state: ListState = { ...initialListState, kind: "account", status: "active" };
    const q = listStateToViewQuery(state, "crm");
    expect(q.type).toBe("account");
    expect(q.status).toBe("active");
    expect((q as Record<string, unknown>).kind).toBeUndefined();
    expect((q as Record<string, unknown>).groupBy).toBeUndefined();
  });

  it("omits every empty/default axis — a bare ListState saves as just {module}", () => {
    expect(listStateToViewQuery(initialListState, "crm")).toEqual({ module: "crm" });
  });

  it("page/pageSize never ride into the query map (pagination is not a saved view axis)", () => {
    const state: ListState = { ...initialListState, page: 4, pageSize: 200 };
    const q = listStateToViewQuery(state, "crm");
    expect(q).toEqual({ module: "crm" });
  });
});

describe("round-trip: listStateToViewQuery(viewQueryToListState(q)) ≈ q", () => {
  it("is stable for a representative, fully-populated query", () => {
    const q = {
      module: "crm",
      text: "acme",
      type: "account",
      status: "active",
      where: ["stage!=lost", "tier>=2"],
      sort: { key: "tier", dir: "desc" as const },
      "group-by": "stage",
    };
    const { module, ...state } = viewQueryToListState(q, "fallback");
    expect(listStateToViewQuery(state, module)).toEqual(q);
  });

  it("is stable for a bare query (module only)", () => {
    const q = { module: "crm" };
    const { module, ...state } = viewQueryToListState(q, "fallback");
    expect(listStateToViewQuery(state, module)).toEqual(q);
  });

  it("is stable for a partially-populated query (where + group-by, no sort/text/type/status)", () => {
    const q = { module: "crm", where: ["stage!=lost"], "group-by": "stage" };
    const { module, ...state } = viewQueryToListState(q, "fallback");
    expect(listStateToViewQuery(state, module)).toEqual(q);
  });
});

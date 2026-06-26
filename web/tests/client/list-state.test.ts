// U11 — the ListContext pull-model state (pure). The reducer (filter/sort/page) +
// project() window are the logic; the .tsx provider is thin (the project's pattern).
import { describe, it, expect } from "vitest";
import { listReducer, initialListState, filterOf, project } from "../../src/client/data/list-state.js";
import type { ModuleItem } from "#shared/index.js";

const item = (id: string, title: string): ModuleItem => ({ id, module: "knowledge", kind: "knowledge", title, status: "active", body: "" });

describe("list-state reducer", () => {
  it("setText/setKind reset the page; toggleSort flips asc↔desc on the same key", () => {
    let s = listReducer({ ...initialListState, page: 3 }, { type: "setText", text: "deck" });
    expect(s.text).toBe("deck");
    expect(s.page).toBe(0);
    s = listReducer(s, { type: "toggleSort", key: "title" });
    expect(s.sort).toEqual({ key: "title", dir: "asc" });
    s = listReducer(s, { type: "toggleSort", key: "title" });
    expect(s.sort!.dir).toBe("desc");
    s = listReducer(s, { type: "toggleSort", key: "status" }); // new key → asc
    expect(s.sort).toEqual({ key: "status", dir: "asc" });
    expect(listReducer(s, { type: "reset" })).toEqual(initialListState);
  });

  it("filterOf passes only the set fields to the DataProvider", () => {
    expect(filterOf(initialListState)).toEqual({});
    expect(filterOf({ ...initialListState, text: "x", kind: "fact" })).toEqual({ text: "x", kind: "fact" });
  });
});

describe("list-state project — sort + paginate the window", () => {
  const items = [item("a", "Cherry"), item("b", "Apple"), item("c", "Banana")];

  it("sorts ascending/descending by a key", () => {
    expect(project(items, { ...initialListState, sort: { key: "title", dir: "asc" } }).rows.map((r) => r.title)).toEqual(["Apple", "Banana", "Cherry"]);
    expect(project(items, { ...initialListState, sort: { key: "title", dir: "desc" } }).rows.map((r) => r.title)).toEqual(["Cherry", "Banana", "Apple"]);
  });

  it("paginates: a window per page + a correct page count", () => {
    const s = { ...initialListState, pageSize: 2 };
    const p0 = project(items, s);
    expect(p0.rows.length).toBe(2);
    expect(p0.total).toBe(3);
    expect(p0.pages).toBe(2);
    expect(project(items, { ...s, page: 1 }).rows.length).toBe(1);
  });
});

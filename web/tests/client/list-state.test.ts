// U11 / Rung 7 — the ListContext pull-model state (pure). The reducer (filter/sort/page)
// is the logic; queryOf() maps it to the SERVER query (the index does filter·sort·paginate
// now — no client-side project() window). The .tsx provider stays thin.
import { describe, it, expect } from "vitest";
import { listReducer, initialListState, queryOf } from "../../src/client/data/list-state.js";

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

  it("queryOf carries the whole control state (filter + sort + page) to getList", () => {
    expect(queryOf(initialListState)).toEqual({ text: "", kind: "", sort: null, page: 0, pageSize: 50 });
    const s = { ...initialListState, text: "x", kind: "fact", sort: { key: "title", dir: "desc" as const }, page: 2 };
    expect(queryOf(s)).toEqual({ text: "x", kind: "fact", sort: { key: "title", dir: "desc" }, page: 2, pageSize: 50 });
  });
});

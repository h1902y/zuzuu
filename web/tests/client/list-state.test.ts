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

  it("addWhere/removeWhere/setWhere manage the clause list (§H.3.1) and reset the page", () => {
    let s = listReducer({ ...initialListState, page: 3 }, { type: "addWhere", clause: "status=active" });
    expect(s.where).toEqual(["status=active"]);
    expect(s.page).toBe(0);
    s = listReducer({ ...s, page: 2 }, { type: "addWhere", clause: "status=active" }); // dedup
    expect(s.where).toEqual(["status=active"]);
    expect(s.page).toBe(2); // no-op — page untouched when nothing changed
    s = listReducer({ ...s, page: 3 }, { type: "addWhere", clause: "tier>=2" });
    expect(s.where).toEqual(["status=active", "tier>=2"]);
    s = listReducer({ ...s, page: 3 }, { type: "removeWhere", clause: "status=active" });
    expect(s.where).toEqual(["tier>=2"]);
    expect(s.page).toBe(0);
    s = listReducer(s, { type: "setWhere", where: ["a=b", "c=d"] });
    expect(s.where).toEqual(["a=b", "c=d"]);
  });

  it("queryOf carries the whole control state (filter + sort + page) to getList", () => {
    expect(queryOf(initialListState)).toEqual({ text: "", kind: "", where: [], sort: null, page: 0, pageSize: 50 });
    const s = { ...initialListState, text: "x", kind: "fact", sort: { key: "title", dir: "desc" as const }, page: 2 };
    expect(queryOf(s)).toEqual({ text: "x", kind: "fact", where: [], sort: { key: "title", dir: "desc" }, page: 2, pageSize: 50 });
  });
});

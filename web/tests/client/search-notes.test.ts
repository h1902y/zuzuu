// P3.2 — cross-note brain search.
import { describe, it, expect } from "vitest";
import type { ModuleItem } from "../../src/shared/index.js";
import { searchNotes } from "../../src/client/shell/search/search-notes.js";

const note = (over: Partial<ModuleItem>): ModuleItem => ({
  id: "n", module: "knowledge", kind: "fact", title: "T", ...over,
});

const items = [
  note({ id: "a", title: "Token auth", kind: "fact", body: "" }),
  note({ id: "b", title: "Sessions", kind: "fact", body: "the token lives in a cookie header" }),
  note({ id: "c", title: "Misc", kind: "token-policy", body: "" }),
];

describe("searchNotes", () => {
  it("blank query → no hits", () => expect(searchNotes(items, "  ")).toEqual([]));
  it("matches title, kind, and body; title ranks first then kind then body", () => {
    const hits = searchNotes(items, "token");
    expect(hits.map((h) => h.id)).toEqual(["a", "c", "b"]); // title, kind, body
  });
  it("includes a snippet around a body match", () => {
    const hit = searchNotes(items, "cookie")[0]!;
    expect(hit.id).toBe("b");
    expect(hit.snippet).toContain("cookie");
  });
  it("a no-match query → empty", () => {
    expect(searchNotes(items, "zzz-nothing")).toEqual([]);
  });
});

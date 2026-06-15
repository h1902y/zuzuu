import { describe, it, expect } from "vitest";
import { capabilitiesFor, slugify, draftSummary, GOALS, CAPABILITY_PHRASES } from "./new-module";

describe("capabilitiesFor", () => {
  it("always includes items.collection (an apply path) even with no goals", () => {
    expect(capabilitiesFor([])).toEqual(["items.collection"]);
  });
  it("unions the selected goals' capabilities, de-duped", () => {
    const caps = capabilitiesFor(["capture-recall", "learn"]);
    expect(caps).toContain("items.collection");
    expect(caps).toContain("query.structured");
    expect(caps).toContain("query.semantic");
    expect(caps).toContain("mine");
    // no duplicate items.collection (capture-recall already bundles it)
    expect(caps.filter((c) => c === "items.collection")).toHaveLength(1);
  });
  it("ignores unknown goal ids", () => {
    expect(capabilitiesFor(["nope"])).toEqual(["items.collection"]);
  });
  it("every goal maps to a real capability with a phrase", () => {
    for (const g of GOALS)
      for (const cap of g.capabilities)
        expect(CAPABILITY_PHRASES[cap]).toBeTruthy();
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My Recipes")).toBe("my-recipes");
  });
  it("strips leading/trailing/duplicate separators and non-alnum", () => {
    expect(slugify("  Café  Notes!! ")).toBe("caf-notes");
    expect(slugify("a__b  c")).toBe("a-b-c");
    expect(slugify("---x---")).toBe("x");
  });
  it("empty/garbage → empty string", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});

describe("draftSummary", () => {
  it("produces a plain-language preview with id, can-phrases, kind, capabilities", () => {
    const d = draftSummary({ title: "My Recipes", goals: ["capture-recall"], kind: "recipe" });
    expect(d.title).toBe("My Recipes");
    expect(d.id).toBe("my-recipes");
    expect(d.kind).toBe("recipe");
    expect(d.capabilities).toContain("items.collection");
    expect(d.can).toContain("store items");
    expect(d.can).toContain("find things by meaning");
  });
  it("falls back: blank title → 'Untitled module', blank kind → 'note'", () => {
    const d = draftSummary({ title: "  ", goals: [], kind: "" });
    expect(d.title).toBe("Untitled module");
    expect(d.kind).toBe("note");
    expect(d.id).toBe("");
    expect(d.capabilities).toEqual(["items.collection"]);
  });
});

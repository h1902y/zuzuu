// P2.6 — the teaching empty-state copy registry.
import { describe, it, expect } from "vitest";
import { emptyCopy, EMPTY_COPY, type EmptyKey } from "../../src/client/shell/empty-copy.js";

describe("emptyCopy", () => {
  it("resolves a known surface to its title + hint", () => {
    expect(emptyCopy("grid-empty")).toEqual({
      title: "No notes yet",
      hint: "zuzuu proposes notes as you work — approve them at the gate and they land here.",
    });
  });
  it("every registered key has a non-empty title + hint", () => {
    for (const key of Object.keys(EMPTY_COPY) as EmptyKey[]) {
      const c = emptyCopy(key);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(0);
    }
  });
});

// tests/client/palette-logic — the palette's fuzzy matcher (pure).

import { describe, it, expect } from "vitest";
import { fuzzyScore, rank } from "../../src/client/palette/palette-logic.js";

describe("fuzzyScore", () => {
  it("matches a subsequence, case-insensitively", () => {
    expect(fuzzyScore("apptsx", "src/app/App.tsx")).not.toBeNull();
    expect(fuzzyScore("", "anything")).toBe(0);
  });
  it("returns null when not a subsequence", () => {
    expect(fuzzyScore("xyz", "src/app/App.tsx")).toBeNull();
  });
  it("scores adjacent/early matches lower (better) than scattered ones", () => {
    const tight = fuzzyScore("app", "app.ts")!;
    const loose = fuzzyScore("app", "a-p-p-end")!;
    expect(tight).toBeLessThan(loose);
  });
});

describe("rank", () => {
  it("orders items best-match first and drops non-matches", () => {
    const files = ["src/app/App.tsx", "README.md", "src/api.ts", "package.json"];
    const out = rank("app", files, (f) => f);
    expect(out[0]).toBe("src/app/App.tsx");
    expect(out).not.toContain("README.md");
  });
  it("honors the limit", () => {
    expect(rank("a", ["aa", "ab", "ac", "ad"], (f) => f, 2)).toHaveLength(2);
  });
});

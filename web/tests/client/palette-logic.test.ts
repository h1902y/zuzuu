// tests/client/palette-logic — the palette's fuzzy matcher (pure).

import { describe, it, expect } from "vitest";
import { fuzzyScore } from "../../src/client/palette/palette-logic.js";

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

// tests/client/palette-logic — the palette's fuzzy matcher (pure).

import { describe, it, expect } from "vitest";
import { fuzzyScore, paletteFilterScore } from "../../src/client/palette/palette-logic.js";

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

describe("paletteFilterScore — exact substring beats fuzzy subsequence (audit item 7)", () => {
  it("the literal note outranks a path-scatter fuzzy match", () => {
    expect(paletteFilterScore("brahman-knowledge:brahman", "brahman")).toBe(1);
    const fuzzy = paletteFilterScore("/private/tmp/scratchpad/onboard-demo", "obd");
    expect(fuzzy).toBeGreaterThan(0);
    expect(fuzzy).toBeLessThan(1);
  });
  it("no match filters out; empty search keeps everything", () => {
    expect(paletteFilterScore("Overview", "brahman")).toBe(0);
    expect(paletteFilterScore("anything", "")).toBe(1);
  });
});

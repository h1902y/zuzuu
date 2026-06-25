// U7 — the copy-owned kit's Button recipe (pure; tested). The .tsx wrapper (Radix
// Slot for asChild) is thin. Every class is token-bound; no arbitrary values.
import { describe, it, expect } from "vitest";
import { buttonRecipe } from "../../src/client/ds/recipes/button.js";

describe("ds kit — Button recipe", () => {
  it("base: focus ring + rounded-ui + inline-flex (token-bound)", () => {
    const c = buttonRecipe({});
    expect(c).toContain("rounded-ui");
    expect(c).toContain("ring-focus");
    expect(c).toContain("inline-flex");
  });

  it("variants map to token utilities; defaults ghost + md", () => {
    expect(buttonRecipe({ variant: "primary" })).toContain("bg-accent");
    expect(buttonRecipe({ variant: "danger" })).toContain("text-danger");
    const icon = buttonRecipe({ size: "icon" });
    expect(icon).toContain("h-8");
    expect(icon).toContain("w-8");
    const d = buttonRecipe({});
    expect(d).toContain("hover:bg-hover"); // ghost default
    expect(d).toContain("h-8");            // md default
  });

  it("no arbitrary-value classes", () => {
    expect(buttonRecipe({ variant: "primary", size: "lg" })).not.toMatch(/\[[^\]]+\]/);
  });
});

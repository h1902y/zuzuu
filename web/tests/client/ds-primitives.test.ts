// U6 — the layout primitives own all spacing/typography via token-bound recipes.
// The recipes are pure (class strings), so we test them directly — the .tsx wrappers
// are thin (the project's logic-in-.ts / thin-JSX pattern). Every class here is a
// token-backed Tailwind utility, never an arbitrary value.
import { describe, it, expect } from "vitest";
import { boxRecipe, stackRecipe, inlineRecipe, gridRecipe, textRecipe } from "../../src/client/ds/primitives/recipes.js";

describe("ds primitive recipes — token-bound spacing & type", () => {
  it("Stack: vertical flex, gap/align/justify map to token utilities; default gap md", () => {
    expect(stackRecipe({ gap: "sm" })).toContain("flex-col");
    expect(stackRecipe({ gap: "sm" })).toContain("gap-2");
    const c = stackRecipe({ align: "center", justify: "between" });
    expect(c).toContain("items-center");
    expect(c).toContain("justify-between");
    expect(stackRecipe({})).toContain("gap-3"); // default md
  });

  it("Inline: horizontal flex, default center + sm gap; wrap toggles flex-wrap", () => {
    const c = inlineRecipe({});
    expect(c).toContain("flex-row");
    expect(c).toContain("items-center");
    expect(c).toContain("gap-2");
    expect(inlineRecipe({ wrap: true })).toContain("flex-wrap");
  });

  it("Grid: cols + gap", () => {
    expect(gridRecipe({ cols: 3 })).toContain("grid-cols-3");
    expect(gridRecipe({ cols: 3 })).toContain("grid");
  });

  it("Text: size/tone/weight/mono map to token utilities; defaults ui + ink-100", () => {
    const c = textRecipe({ size: "meta", tone: "muted", mono: true });
    expect(c).toContain("text-meta");
    expect(c).toContain("text-muted");
    expect(c).toContain("font-mono");
    expect(textRecipe({})).toContain("text-ui");
    expect(textRecipe({})).toContain("text-ink-100");
  });

  it("Box: pad/bg/border/radius map to token utilities (no arbitrary values)", () => {
    const c = boxRecipe({ pad: "md", bg: "surface", border: "hairline", radius: "ui" });
    expect(c).toContain("p-3");
    expect(c).toContain("bg-surface");
    expect(c).toContain("border-border");
    expect(c).toContain("rounded-ui");
    // no arbitrary-value classes anywhere in the recipe output
    expect(c).not.toMatch(/\[[^\]]+\]/);
  });
});

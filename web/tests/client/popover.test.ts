// ds/kit/Popover.tsx — the shared anchored popover primitive (U2, curried-plotting
// -coral.md). Framework-free / no-DOM: the pure model (popover-model.ts) is tested
// directly; the dismiss wiring itself is U1-tested (dismiss-model.test.ts,
// overlay-stack.test.ts), so here we only add a source-wiring assertion that
// Popover actually composes it correctly (the "unconditional, above the early
// return" rule use-dismiss.ts documents) — the same convention
// proposal-surfaces.test.ts uses for seams that aren't pure functions.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  makeSelectHandler, placementClasses, resolveOverlayId, type PopoverPlacement,
} from "../../src/client/ds/kit/popover-model.js";

describe("placementClasses — exhaustive, token-bound position classes", () => {
  it("below-left (the default) matches TableBuilders.tsx's existing Panel shape", () => {
    expect(placementClasses("below-left")).toBe("top-full left-0");
  });

  it("covers all four placements with no arbitrary values", () => {
    const cases: Record<PopoverPlacement, string> = {
      "below-left": "top-full left-0",
      "below-right": "top-full right-0",
      "above-left": "bottom-full left-0",
      "above-right": "bottom-full right-0",
    };
    for (const [placement, expected] of Object.entries(cases)) {
      expect(placementClasses(placement as PopoverPlacement)).toBe(expected);
    }
  });
});

describe("resolveOverlayId — explicit id wins, else the generated (useId) one", () => {
  it("an explicit id (the U4 coordinator's case) is used verbatim", () => {
    expect(resolveOverlayId("filter-popover", "r:1")).toBe("filter-popover");
  });

  it("falls back to the generated id when the caller doesn't name it", () => {
    expect(resolveOverlayId(undefined, "r:1")).toBe("r:1");
  });
});

describe("makeSelectHandler — the closeOnSelect wrapping contract", () => {
  it("always fires onSelect, regardless of closeOnSelect", () => {
    let selected = 0;
    const handler = makeSelectHandler(() => { selected += 1; }, () => {}, false);
    handler();
    expect(selected).toBe(1);
  });

  it("closeOnSelect=true also fires onClose — single-select menus (Group/Sort) close on pick", () => {
    const calls: string[] = [];
    const handler = makeSelectHandler(() => calls.push("select"), () => calls.push("close"), true);
    handler();
    expect(calls).toEqual(["select", "close"]); // the pick lands before the popover closes
  });

  it("closeOnSelect=false never fires onClose — a multi-add panel (Filter) stays open across picks", () => {
    let closed = false;
    const handler = makeSelectHandler(() => {}, () => { closed = true; }, false);
    handler();
    handler();
    handler();
    expect(closed).toBe(false);
  });

  it("onSelect fires exactly once per invocation, independent of closeOnSelect", () => {
    let selected = 0;
    const handler = makeSelectHandler(() => { selected += 1; }, () => {}, true);
    handler();
    handler();
    expect(selected).toBe(2);
  });
});

describe("Popover.tsx source wiring — composes useDismiss unconditionally, above the early return", () => {
  const src = readFileSync(fileURLToPath(new URL("../../src/client/ds/kit/Popover.tsx", import.meta.url)), "utf8");

  it("imports useDismiss from the overlay module (U1), not a hand-rolled listener", () => {
    expect(src).toMatch(/import \{ useDismiss \} from "\.\/overlay\/index\.js";/);
    expect(src).not.toMatch(/addEventListener\(["']keydown["']/);
    expect(src).not.toMatch(/addEventListener\(["']pointerdown["']/);
  });

  it("calls useDismiss with the full contract: id, onClose, closeOnEscape, closeOnOutside, ref", () => {
    expect(src).toMatch(
      /useDismiss\(\{\s*id:\s*overlayId,\s*onClose,\s*closeOnEscape:\s*true,\s*closeOnOutside:\s*true,\s*ref\s*\}\);/,
    );
  });

  it("the useDismiss call sits ABOVE the `if (!open)` early return (hooks can't be conditional)", () => {
    const dismissAt = src.indexOf("useDismiss({");
    const earlyReturnAt = src.indexOf("if (!open) return null;");
    expect(dismissAt).toBeGreaterThan(-1);
    expect(earlyReturnAt).toBeGreaterThan(-1);
    expect(dismissAt).toBeLessThan(earlyReturnAt);
  });

  it("no hand-rolled Scrim — the outside-full-screen dismiss button TableBuilders.tsx copy-pastes 3x is gone", () => {
    expect(src).not.toMatch(/aria-label="close"/);
    expect(src).not.toMatch(/fixed inset-0/);
  });

  it("renders the same token-bound panel shape TableBuilders.tsx's Panel uses (no redesign)", () => {
    for (const cls of ["animate-pop", "absolute", "z-20", "w-72", "rounded-ui", "border-border", "bg-elevated", "shadow-overlay"]) {
      expect(src).toContain(cls);
    }
  });

  it("PopoverItem composes makeSelectHandler (the closeOnSelect contract), not its own inline onClick logic", () => {
    expect(src).toMatch(/makeSelectHandler\(onSelect, ctx\?\.onClose/);
  });
});

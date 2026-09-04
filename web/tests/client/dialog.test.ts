// ds/kit/Dialog.tsx source wiring (U3, curried-plotting-coral.md) — Dialog is the ONE
// governed dialog primitive; this proves it composes useDismiss (U1) instead of its
// former private `window` keydown Escape listener. Framework-free / no-DOM: Dialog's
// dismiss wiring itself is U1-tested (dismiss-model.test.ts, overlay-stack.test.ts);
// here we only assert the SOURCE composes it correctly (the same convention
// popover.test.ts / proposal-surfaces.test.ts use for seams that aren't pure functions).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("../../src/client/ds/kit/Dialog.tsx", import.meta.url)), "utf8");

describe("Dialog.tsx source wiring — composes useDismiss unconditionally, above the early return", () => {
  it("imports useDismiss from the overlay module (U1), not a hand-rolled listener", () => {
    expect(src).toMatch(/import \{ useDismiss \} from "\.\/overlay\/index\.js";/);
    expect(src).not.toMatch(/addEventListener\(["']keydown["']/);
    expect(src).not.toMatch(/addEventListener\(["']pointerdown["']/);
  });

  it("calls useDismiss with the full contract: id, onClose, closeOnEscape, closeOnOutside, enabled, ref", () => {
    expect(src).toMatch(
      /useDismiss\(\{\s*id:\s*overlayId,\s*onClose:\s*onClose \?\? noop,\s*closeOnEscape:\s*true,\s*closeOnOutside:\s*true,\s*enabled:\s*open && onClose !== undefined,\s*ref,\s*\}\);/,
    );
  });

  it("the useDismiss call sits ABOVE the `if (!open)` early return (hooks can't be conditional)", () => {
    const dismissAt = src.indexOf("useDismiss({");
    const earlyReturnAt = src.indexOf("if (!open) return null;");
    expect(dismissAt).toBeGreaterThan(-1);
    expect(earlyReturnAt).toBeGreaterThan(-1);
    expect(dismissAt).toBeLessThan(earlyReturnAt);
  });

  it("a locked dialog (onClose omitted) folds into ONE `enabled` gate — no separate conditional hook call", () => {
    // `open && onClose !== undefined` is the single flag threaded into useDismiss's
    // `enabled` option — closed OR locked both mean "register nothing," per
    // use-dismiss.ts's own doc for that option. The hook call site itself never
    // moves — only the boolean it's given changes.
    expect(src).toContain("enabled: open && onClose !== undefined");
    expect(src).toContain("onClose: onClose ?? noop");
  });

  it("the scrim stays a plain dimming div (dismissal itself comes from useDismiss, not this button's onClick alone driving Escape)", () => {
    expect(src).toMatch(/aria-label="dismiss dialog"/);
    expect(src).toMatch(/bg-scrim/);
  });

  it("title and footer are both optional — a child can own its own heading (WorkbenchShell's Settings dialog) or its own inline action row (Diff's modal)", () => {
    expect(src).toMatch(/title\?:\s*ReactNode/);
    expect(src).toMatch(/footer\?:\s*ReactNode/);
    expect(src).toContain("footer !== undefined && ");
    expect(src).toContain("title !== undefined && ");
  });
});

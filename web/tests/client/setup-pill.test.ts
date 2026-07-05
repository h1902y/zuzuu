// shell/onboarding/SetupPill.tsx source wiring (U6, curried-plotting-coral.md) — the
// re-surface DECISION itself is pure and tested directly (onboarding-state.test.ts's
// stepIdentity/shouldResurface suite); here we only assert the SOURCE composes it
// correctly and drops the old bug — the same convention dialog.test.ts / popover.test.ts
// use for seams that aren't pure functions.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("../../src/client/shell/onboarding/SetupPill.tsx", import.meta.url)), "utf8");

describe("SetupPill.tsx source wiring — the dismissed-state decoupled from step.kind re-renders", () => {
  it("the old bug is GONE: no more useEffect resetting dismissed on every step?.kind recompute", () => {
    expect(src).not.toMatch(/useEffect\(\(\)\s*=>\s*\{?\s*setDismissed\(false\)/);
    expect(src).not.toMatch(/\[step\?\.kind\]/);
  });

  it("dismissal is tracked by IDENTITY (stepIdentity/shouldResurface), not a plain boolean reset by an effect", () => {
    expect(src).toMatch(/import \{ stepIdentity, shouldResurface,.*\} from "\.\/onboarding-state\.js";/);
    expect(src).toMatch(/const identity = stepIdentity\(step\);/);
    expect(src).toMatch(/const dismissed = lastDismissed !== null && !shouldResurface\(identity, lastDismissed\);/);
  });

  it("imports useDismiss from the ds surface — outside-click dismissal is new (U6)", () => {
    expect(src).toMatch(/import \{ Icon, useDismiss \} from "\.\.\/\.\.\/ds\/index\.js";/);
  });

  it("registers as overlay id \"setup-pill\" with closeOnOutside true, enabled only while visible", () => {
    expect(src).toMatch(
      /useDismiss\(\{\s*id:\s*"setup-pill",\s*onClose:\s*dismiss,\s*closeOnOutside:\s*true,\s*enabled:\s*visible,\s*ref\s*\}\);/,
    );
  });

  it("the useDismiss call sits ABOVE the `if (!visible) return null` early return (hooks can't be conditional)", () => {
    const dismissAt = src.indexOf("useDismiss({");
    const earlyReturnAt = src.indexOf("if (!visible) return null;");
    expect(dismissAt).toBeGreaterThan(-1);
    expect(earlyReturnAt).toBeGreaterThan(-1);
    expect(dismissAt).toBeLessThan(earlyReturnAt);
  });

  it("the X hit target is enlarged — real padding (p-2) + a rounded hit area, not a bare icon-sized button", () => {
    expect(src).toMatch(/className="absolute right-1 top-1 z-10 rounded-full p-2 text-muted hover:bg-surface hover:text-ink-100"/);
    // the old bare-icon button (right-3/top-3, no padding) is gone
    expect(src).not.toMatch(/className="absolute right-3 top-3 z-10 text-muted hover:text-ink-100"/);
  });

  it("the dismiss button and the useDismiss registration share ONE close path (dismiss()), not two divergent ones", () => {
    expect(src).toMatch(/const dismiss = \(\) => setLastDismissed\(identity\);/);
    expect(src).toMatch(/onClick=\{dismiss\}/);
    expect(src).toMatch(/onClose:\s*dismiss/);
  });
});

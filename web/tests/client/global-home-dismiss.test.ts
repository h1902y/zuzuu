// shell/projects/GlobalHome.tsx source wiring (U6, curried-plotting-coral.md) — the
// project-detail inspector had NO real dismiss at all (no Escape, no outside-click,
// no X — only picking a different node replaced it). Framework-free / no-DOM: the
// dismiss wiring itself is U1-tested (dismiss-model.test.ts, overlay-stack.test.ts);
// here we only assert the SOURCE composes it correctly — the same convention
// dialog.test.ts / popover.test.ts use for seams that aren't pure functions.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("../../src/client/shell/projects/GlobalHome.tsx", import.meta.url)), "utf8");

describe("GlobalHome.tsx source wiring — the inspector card gets a real dismiss", () => {
  it("imports useDismiss from the ds surface", () => {
    expect(src).toMatch(/useDismiss/);
    expect(src).toMatch(/from "\.\.\/\.\.\/ds\/index\.js";/);
  });

  it("registers the inspector as overlay id \"global-home-inspector\", gated on a selection existing", () => {
    expect(src).toMatch(
      /useDismiss\(\{\s*id:\s*"global-home-inspector",\s*onClose:\s*closeInspector,\s*enabled:\s*sel !== null,\s*ref:\s*inspectorRef\s*\}\);/,
    );
  });

  it("closeInspector clears the selection — the same close path the visible X uses", () => {
    expect(src).toMatch(/const closeInspector = \(\) => setSelected\(null\);/);
    expect(src).toMatch(/onClick=\{closeInspector\}/);
  });

  it("the inspector's root div carries the dismiss ref, so outside-click detection anchors on the ACTUAL card, not the whole canvas", () => {
    expect(src).toMatch(/<div ref=\{inspectorRef\}/);
  });

  it("renders a VISIBLE close affordance (an X) on the inspector card, not just a keystroke", () => {
    expect(src).toMatch(/aria-label="dismiss project detail"/);
    expect(src).toMatch(/icon=\{X\}/);
  });

  it("useDismiss is called unconditionally at the top of the component, not inside the `{sel && (…)}` conditional render", () => {
    const dismissAt = src.indexOf("useDismiss({");
    const condRenderAt = src.indexOf("{sel && (");
    expect(dismissAt).toBeGreaterThan(-1);
    expect(condRenderAt).toBeGreaterThan(-1);
    expect(dismissAt).toBeLessThan(condRenderAt);
  });
});

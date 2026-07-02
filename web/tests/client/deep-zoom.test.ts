// world/model — deepZoomModule: the crystallize gesture's trigger (pure).
import { describe, expect, it } from "vitest";
import { deepZoomModule, DEEP_ZOOM } from "../../src/client/world/model.js";

const view = { w: 1000, h: 800 };
// world point under the viewport center: wx = (w/2 - tx)/k
const centeredOn = (wx: number, wy: number, k: number) =>
  ({ k, x: view.w / 2 - wx * k, y: view.h / 2 - wy * k });

const spreads = [
  { module: "crm", cx: 100, cy: 100, r: 80 },
  { module: "knowledge", cx: 500, cy: 400, r: 120 },
];

describe("deepZoomModule", () => {
  it("null below the deep-zoom threshold, whatever is centered", () => {
    expect(deepZoomModule(spreads, centeredOn(100, 100, DEEP_ZOOM - 0.5), view)).toBeNull();
  });

  it("the island under the viewport center at deep zoom", () => {
    expect(deepZoomModule(spreads, centeredOn(100, 100, DEEP_ZOOM), view)).toBe("crm");
    expect(deepZoomModule(spreads, centeredOn(510, 390, 6), view)).toBe("knowledge");
  });

  it("null in open water between islands", () => {
    expect(deepZoomModule(spreads, centeredOn(300, 250, 6), view)).toBeNull();
  });

  it("overlapping spreads resolve to the NEAREST island center", () => {
    const overlapping = [
      { module: "a", cx: 0, cy: 0, r: 300 },
      { module: "b", cx: 100, cy: 0, r: 300 },
    ];
    expect(deepZoomModule(overlapping, centeredOn(90, 0, 6), view)).toBe("b");
    expect(deepZoomModule(overlapping, centeredOn(10, 0, 6), view)).toBe("a");
  });
});

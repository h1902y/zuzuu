// tests/client/dashboard-data — the modules-dashboard shaping (pure).

import { describe, it, expect } from "vitest";
import { toTiles, totalPending } from "../../src/client/panel/dashboard-data.js";
import type { ModuleOverviewResponse } from "#shared/index.js";

const overview: ModuleOverviewResponse = {
  modules: [
    { id: "knowledge", title: "Knowledge", counts: { items: 12, pending: 2, errors: 0 }, top: ["a", "b"] },
    { id: "guardrails", title: "Guardrails", ui: { icon: "lock", accent: "danger", teaching: "x" }, counts: { items: 3, pending: 0, errors: 1 }, top: [], enabled: false },
  ],
};

describe("toTiles", () => {
  it("maps entries to tiles with built-in icon/accent fallbacks", () => {
    const tiles = toTiles(overview);
    expect(tiles[0]).toMatchObject({ key: "knowledge", title: "Knowledge", icon: "book", accent: "info", items: 12, pending: 2, enabled: true });
  });
  it("prefers the manifest ui block over the fallback", () => {
    const guardrails = toTiles(overview)[1]!;
    expect(guardrails.icon).toBe("lock"); // from ui, not the "shield" fallback
    expect(guardrails.accent).toBe("danger");
    expect(guardrails.enabled).toBe(false);
    expect(guardrails.errors).toBe(1);
  });
});

describe("totalPending", () => {
  it("sums pending across modules", () => {
    expect(totalPending(overview)).toBe(2);
  });
});

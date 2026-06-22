// tests/client/dashboard-data — the modules-dashboard shaping (pure).

import { describe, it, expect } from "vitest";
import { toTiles } from "../../src/client/panel/dashboard-data.js";
import type { ModuleOverviewResponse } from "#shared/index.js";

const overview: ModuleOverviewResponse = {
  modules: [
    { id: "knowledge", title: "Knowledge", counts: { items: 12, pending: 2, errors: 0 }, top: ["a", "b"] },
    { id: "guardrails", title: "Guardrails", counts: { items: 3, pending: 0, errors: 1 }, top: [], enabled: false },
  ],
};

describe("toTiles", () => {
  it("maps overview entries to tile view-models", () => {
    const tiles = toTiles(overview);
    expect(tiles[0]).toMatchObject({ key: "knowledge", title: "Knowledge", items: 12, pending: 2, enabled: true });
  });
  it("carries enabled + errors through", () => {
    const guardrails = toTiles(overview)[1]!;
    expect(guardrails.enabled).toBe(false);
    expect(guardrails.errors).toBe(1);
  });
});

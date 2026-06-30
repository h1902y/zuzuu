// U6 — the Project home model (health summary + last-activity).
import { describe, it, expect } from "vitest";
import type { ModuleOverviewEntry, SessionInfo } from "../../src/shared/index.js";
import { brainSummary, lastSessionActivity } from "../../src/client/shell/overview/overview-model.js";

const mod = (id: string, items: number, pending: number): ModuleOverviewEntry => ({
  id, title: id, counts: { items, pending, errors: 0 }, top: [],
});

const sess = (id: string, alive: boolean, createdAt: number): SessionInfo => ({
  id, title: id, cwd: "/", alive, createdAt, type: "shell",
});

describe("brainSummary", () => {
  it("rolls modules into tables/notes/pending", () => {
    expect(brainSummary([mod("a", 3, 1), mod("b", 5, 0), mod("c", 0, 2)])).toEqual({ tables: 3, notes: 8, pending: 3 });
  });
  it("an empty brain → all zeros", () => {
    expect(brainSummary([])).toEqual({ tables: 0, notes: 0, pending: 0 });
  });
});

describe("lastSessionActivity", () => {
  it("returns the newest createdAt", () => {
    expect(lastSessionActivity([sess("a", false, 100), sess("b", true, 200)])).toBe(200);
  });
  it("no sessions → 0", () => {
    expect(lastSessionActivity([])).toBe(0);
  });
});

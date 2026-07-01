// U6 — the Project home model (health summary + last-activity).
import { describe, it, expect } from "vitest";
import type { ModuleOverviewEntry, SessionInfo } from "../../src/shared/index.js";
import { brainSummary, lastSessionActivity, homeModel, needsMeCopy } from "../../src/client/shell/overview/overview-model.js";

const mod = (id: string, items: number, pending: number, errors = 0): ModuleOverviewEntry => ({
  id, title: id, counts: { items, pending, errors }, top: [],
});

const sess = (id: string, alive: boolean, createdAt: number): SessionInfo => ({
  id, title: id, cwd: "/", alive, createdAt, type: "shell",
});

describe("brainSummary", () => {
  it("rolls modules into tables/notes/pending/integrity", () => {
    expect(brainSummary([mod("a", 3, 1), mod("b", 5, 0), mod("c", 0, 2)])).toEqual({ tables: 3, notes: 8, pending: 3, integrity: 0 });
  });
  it("sums module errors into the integrity signal", () => {
    expect(brainSummary([mod("a", 3, 1, 2), mod("b", 5, 0, 1)]).integrity).toBe(3);
  });
  it("an empty brain → all zeros", () => {
    expect(brainSummary([])).toEqual({ tables: 0, notes: 0, pending: 0, integrity: 0 });
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

describe("homeModel — the 'what needs me' lead state", () => {
  const base = { pendingCount: 0, heldCount: 0, sessionCount: 0, setupIncomplete: false };
  it("pending proposals → needs-me, review shown, copy names the count", () => {
    const m = homeModel({ ...base, pendingCount: 36 });
    expect(m.lead).toBe("needs-me");
    expect(m.showReview).toBe(true);
    expect(m.needsMeCount).toBe(36);
    expect(m.copy).toContain("36 proposals");
  });
  it("held sessions ALSO count as needs-me (composite), even with 0 pending", () => {
    const m = homeModel({ ...base, heldCount: 1, sessionCount: 2 });
    expect(m.lead).toBe("needs-me");
    expect(m.copy).toContain("1 session awaiting merge");
  });
  it("setup-incomplete wins over pending, and suppresses the review hero (R6)", () => {
    const m = homeModel({ ...base, pendingCount: 5, setupIncomplete: true });
    expect(m.lead).toBe("setup");
    expect(m.showReview).toBe(false); // hero suppressed while onboarding, even with pending
  });
  it("no sessions, nothing pending → first (calm)", () => {
    expect(homeModel(base).lead).toBe("first");
  });
  it("sessions, nothing pending → steady, all caught up, no review", () => {
    const m = homeModel({ ...base, sessionCount: 2 });
    expect(m.lead).toBe("steady");
    expect(m.showReview).toBe(false);
    expect(m.copy).toBe("All caught up.");
  });
});

describe("needsMeCopy", () => {
  it("names both classes when both present", () => {
    expect(needsMeCopy(36, 1)).toBe("36 proposals to review · 1 session awaiting merge — waiting for you");
  });
  it("singular + single class", () => {
    expect(needsMeCopy(1, 0)).toBe("1 proposal to review — waiting for you");
  });
});

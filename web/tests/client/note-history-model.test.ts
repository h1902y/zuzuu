// §G.1 — the History group's pure model: actor bucketing + the extras summary.
import { describe, it, expect } from "vitest";
import { actorBucket, historyExtra, historyOpLabel } from "../../src/client/note/note-history-model.js";
import type { HistoryEntry } from "#shared/index.js";

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry =>
  ({ event: "update", ts: null, note: "acme", actor: "human", ...over });

describe("actorBucket", () => {
  it("the four named substrate buckets pass through", () => {
    expect(actorBucket("human")).toBe("human");
    expect(actorBucket("agent")).toBe("agent");
    expect(actorBucket("migration")).toBe("migration");
    expect(actorBucket("ingestion")).toBe("ingestion");
  });
  it("an unnamed actor (e.g. init's seed writes) buckets to 'other', never invented", () => {
    expect(actorBucket("init")).toBe("other");
  });
  it("absent actor buckets to 'other'", () => {
    expect(actorBucket(undefined)).toBe("other");
  });
});

describe("historyExtra", () => {
  it("a bare entry (only the four owned keys) has no extra", () => {
    expect(historyExtra(entry())).toBeNull();
  });
  it("a proposal id surfaces as the extra", () => {
    expect(historyExtra(entry({ proposal: "p1" }))).toBe("proposal: p1");
  });
  it("a backfill marker surfaces", () => {
    expect(historyExtra(entry({ backfill: "envelope-floor" }))).toBe("backfill: envelope-floor");
  });
  it("an array extra joins with commas", () => {
    expect(historyExtra(entry({ mintedFrom: ["p1", "p2"] } as unknown as Partial<HistoryEntry>))).toBe("mintedFrom: p1, p2");
  });
  it("empty-string/null extras are skipped, falling through to the next key", () => {
    const e = entry({ note: "acme" }); // note is owned
    (e as unknown as Record<string, unknown>).blank = "";
    (e as unknown as Record<string, unknown>).relation = "about";
    expect(historyExtra(e)).toBe("relation: about");
  });
});

describe("historyOpLabel", () => {
  it("is the raw event name", () => {
    expect(historyOpLabel(entry({ event: "create" }))).toBe("create");
    expect(historyOpLabel(entry({ event: "deprecate" }))).toBe("deprecate");
  });
});

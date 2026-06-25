// U7 logic — the cross-session review queue: aggregate, group, reason-gated reject.
import { describe, it, expect } from "vitest";
import { aggregateStaged, groupBy, isCaughtUp, validReject, REJECT_REASONS } from "../../src/client/shell/review/review-model.js";
import type { StagedSummary } from "#shared/index.js";

const s = (id: string, module: string): StagedSummary => ({ id, module, title: id.toUpperCase() });

describe("review-model", () => {
  it("aggregateStaged flattens per-module staged into one cross-session queue", () => {
    const q = aggregateStaged({ knowledge: [s("a", "knowledge"), s("b", "knowledge")], actions: [s("c", "actions")] });
    expect(q.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("groupBy partitions the queue (e.g. by module), first-seen order", () => {
    const q = [s("a", "knowledge"), s("c", "actions"), s("b", "knowledge")];
    const g = groupBy(q, "module");
    expect(Object.keys(g)).toEqual(["knowledge", "actions"]);
    expect((g.knowledge ?? []).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("isCaughtUp at zero (the calm empty state)", () => {
    expect(isCaughtUp([])).toBe(true);
    expect(isCaughtUp([s("a", "knowledge")])).toBe(false);
  });

  it("validReject gates on the reason taxonomy (the gate that teaches)", () => {
    expect(REJECT_REASONS).toContain("duplicate");
    expect(validReject("scope")).toBe(true);
    expect(validReject("")).toBe(false);
    expect(validReject("whatever")).toBe(false);
  });
});

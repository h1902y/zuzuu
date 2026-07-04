// U6 — session/run grouping: an axis alongside the existing module axis
// (review-model.ts's groupByAxis), consumed by ReviewQueue.tsx's toggle and
// use-review-queue.ts's hook. Framework-free: pure model tests, no DOM (the
// project's convention — see vital-signs-style suites: review-model.test.ts,
// scorer.test.ts, review-gestures.test.ts).
import { describe, it, expect } from "vitest";
import type { StagedSummary } from "#shared/index.js";
import {
  groupBy, groupByAxis, sessionKeyOf, scoreQueue, sortByScore, NO_SESSION_BUCKET,
} from "../../src/client/shell/review/review-model.js";
import { batchTargets } from "../../src/client/shell/review/review-flow.js";
import { needsScrutiny, SAFE_TAIL_THRESHOLD } from "../../src/client/shell/review/score.js";

const s = (
  over: Partial<StagedSummary> & { id: string; module: string },
): StagedSummary => ({
  title: over.id.toUpperCase(),
  ...over,
});

/** A `source` pointer naming one or more origin sessions, in first-seen/append
 *  order (provenance.ts's convention — see its header). */
const src = (sessions: string[]) => ({ producer: "observe", kind: "entity", sessions });

describe("sessionKeyOf — the session/run bucket key for one proposal", () => {
  it("a single-session proposal buckets under that session", () => {
    const item = s({ id: "a", module: "knowledge", source: src(["claude-code:run1"]) });
    expect(sessionKeyOf(item)).toBe("claude-code:run1");
  });

  it("a multi-session proposal buckets under its MOST-RECENT session — the LAST id in provenance's append-ordered list (documented: 'most recent' = last-in-list)", () => {
    const item = s({
      id: "b",
      module: "knowledge",
      source: src(["claude-code:first-touch", "claude-code:second-touch", "claude-code:latest-run"]),
    });
    expect(sessionKeyOf(item)).toBe("claude-code:latest-run");
  });

  it("a proposal with no resolvable provenance (no source, or a source with no session ids) lands in the stable NO_SESSION_BUCKET — never silently dropped", () => {
    expect(sessionKeyOf(s({ id: "c", module: "knowledge" }))).toBe(NO_SESSION_BUCKET);
    expect(sessionKeyOf(s({ id: "d", module: "knowledge", source: { producer: "observe", sessions: [] } }))).toBe(NO_SESSION_BUCKET);
  });
});

describe("groupByAxis — session/run bucketing (U6's new axis)", () => {
  it("buckets proposals by their origin session, first-seen order", () => {
    const items = [
      s({ id: "a", module: "knowledge", source: src(["run-1"]) }),
      s({ id: "b", module: "actions", source: src(["run-2"]) }),
      s({ id: "c", module: "knowledge", source: src(["run-1"]) }),
    ];
    const grouped = groupByAxis(items, "session");
    expect(Object.keys(grouped)).toEqual(["run-1", "run-2"]);
    expect((grouped["run-1"] ?? []).map((x) => x.id)).toEqual(["a", "c"]);
    expect((grouped["run-2"] ?? []).map((x) => x.id)).toEqual(["b"]);
  });

  it("a multi-session proposal lands in exactly the documented bucket (its most-recent session), not fragmented across all its sessions", () => {
    const items = [
      s({ id: "multi", module: "knowledge", source: src(["run-old", "run-new"]) }),
      s({ id: "solo", module: "actions", source: src(["run-new"]) }),
    ];
    const grouped = groupByAxis(items, "session");
    expect(Object.keys(grouped)).toEqual(["run-new"]);
    expect((grouped["run-new"] ?? []).map((x) => x.id).sort()).toEqual(["multi", "solo"]);
    expect(grouped["run-old"]).toBeUndefined();
  });

  it("proposals with no provenance collect into NO_SESSION_BUCKET rather than vanishing", () => {
    const items = [
      s({ id: "hand-staged", module: "knowledge" }),
      s({ id: "mined", module: "knowledge", source: src(["run-1"]) }),
    ];
    const grouped = groupByAxis(items, "session");
    expect((grouped[NO_SESSION_BUCKET] ?? []).map((x) => x.id)).toEqual(["hand-staged"]);
    expect((grouped["run-1"] ?? []).map((x) => x.id)).toEqual(["mined"]);
  });

  it("axis 'module' is identical to the existing groupBy(items, \"module\") — no regression", () => {
    const items = [
      s({ id: "a", module: "knowledge" }),
      s({ id: "b", module: "actions" }),
      s({ id: "c", module: "knowledge" }),
    ];
    expect(groupByAxis(items, "module")).toEqual(groupBy(items, "module"));
  });
});

describe("the toggle regroups the SAME fetched queue without a refetch — module ↔ session are two pure views over one array", () => {
  it("switching axis re-partitions identically-scored/sorted input differently, with no mutation of the source queue", () => {
    const queue = sortByScore(scoreQueue([
      s({ id: "a", module: "knowledge", op: "create", confidence: "high", source: src(["run-1"]) }),
      s({ id: "b", module: "actions", op: "delete", confidence: "high", source: src(["run-2"]) }),
      s({ id: "c", module: "knowledge", op: "update", confidence: "low", source: src(["run-1"]) }),
    ]));
    const beforeIds = queue.map((x) => x.id);

    const byModule = groupByAxis(queue, "module");
    const bySession = groupByAxis(queue, "session");

    // same input queue, unmutated, regardless of how many times we regroup it
    expect(queue.map((x) => x.id)).toEqual(beforeIds);
    // different bucket shapes from the SAME array — no refetch, no new data source
    expect(Object.keys(byModule).sort()).toEqual(["actions", "knowledge"]);
    expect(Object.keys(bySession).sort()).toEqual(["run-1", "run-2"]);
    // every item present in both views — a regroup, not a re-fetch/re-filter
    const flatten = (g: Record<string, { id: string }[]>) => Object.values(g).flat().map((x) => x.id).sort();
    expect(flatten(byModule)).toEqual(flatten(bySession));
  });
});

describe("within a session-group, items stay score-sorted (U4 preserved across the axis switch)", () => {
  it("a session-group's item order matches the flat score-sorted queue's relative order for that group", () => {
    const queue = sortByScore(scoreQueue([
      // all three born from the SAME run, deliberately built out of score order
      s({ id: "low-blast", module: "knowledge", op: "create", confidence: "high", source: src(["run-1"]) }),
      s({ id: "critical-blast", module: "knowledge", op: "delete", confidence: "high", source: src(["run-1"]) }),
      s({ id: "elevated-blast", module: "guardrails", op: "update", confidence: "high", source: src(["run-1"]) }),
    ]));
    // sanity: sortByScore really did put highest-attention first
    expect(queue.map((x) => x.id)).toEqual(["critical-blast", "elevated-blast", "low-blast"]);

    const bySession = groupByAxis(queue, "session");
    expect((bySession["run-1"] ?? []).map((x) => x.id)).toEqual(["critical-blast", "elevated-blast", "low-blast"]);
  });

  it("interleaved-run items still sort correctly within their own run bucket", () => {
    const queue = sortByScore(scoreQueue([
      s({ id: "run1-safe", module: "knowledge", op: "create", confidence: "high", source: src(["run-1"]) }),
      s({ id: "run2-critical", module: "actions", op: "delete", confidence: "high", source: src(["run-2"]) }),
      s({ id: "run1-critical", module: "actions", op: "delete", confidence: "high", source: src(["run-1"]) }),
      s({ id: "run2-safe", module: "knowledge", op: "update", confidence: "high", source: src(["run-2"]) }),
    ]));
    const bySession = groupByAxis(queue, "session");
    expect((bySession["run-1"] ?? []).map((x) => x.id)).toEqual(["run1-critical", "run1-safe"]);
    expect((bySession["run-2"] ?? []).map((x) => x.id)).toEqual(["run2-critical", "run2-safe"]);
  });
});

describe("a session/run group is a valid batch-approve scope (integrates with U5, KTD4 guard holds)", () => {
  const queue = sortByScore(scoreQueue([
    s({ id: "safe-1", module: "knowledge", op: "create", confidence: "high", source: src(["run-1"]) }), // low blast → safe-tail
    s({ id: "scrutiny-1", module: "guardrails", op: "create", confidence: "high", source: src(["run-1"]) }), // elevated → needsScrutiny
    s({ id: "safe-2", module: "knowledge", op: "update", confidence: "high", source: src(["run-2"]) }), // different run
  ]));
  const bySession = groupByAxis(queue, "session");
  const run1 = bySession["run-1"] ?? [];

  it("fixture sanity — run-1 has both a safe-tail and a needs-scrutiny item", () => {
    expect(run1.map((x) => x.id).sort()).toEqual(["safe-1", "scrutiny-1"]);
    expect(run1.some((x) => needsScrutiny(x))).toBe(true);
    expect(run1.some((x) => !needsScrutiny(x))).toBe(true);
  });

  it("an EMPTY selection scoped to a run-group only offers that run's safe tail — the needsScrutiny item in the SAME run is never swept in", () => {
    const targets = batchTargets(run1, new Set());
    expect(targets.map((t) => t.id)).toEqual(["safe-1"]);
    for (const t of targets) expect(t.score).toBeLessThan(SAFE_TAIL_THRESHOLD);
  });

  it("a run-group's batch scope never leaks in items from another run", () => {
    const targets = batchTargets(run1, new Set());
    expect(targets.some((t) => t.id === "safe-2")).toBe(false);
  });

  it("an explicit selection of the needsScrutiny item within a run-group is a legitimate individual override, not a sweep", () => {
    const targets = batchTargets(run1, new Set(["scrutiny-1"]));
    expect(targets.map((t) => t.id)).toEqual(["scrutiny-1"]);
  });
});

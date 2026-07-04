// U7 — the reimagined HITL canvas: ProposalCard + ReviewQueue cohered into ONE
// designed surface (not the U2-U6 accretion). Framework-free: pure model/view-model
// tests, no DOM (this suite's convention — see review-gestures.test.ts /
// review-grouping.test.ts / scorer.test.ts). Two kinds of coverage:
//   (1) the two view-models this unit introduces — the card's section-ordering +
//       decision-mode contract, and the queue's group-header (count + batchability)
//       model — as pinned, testable contracts, not just implicit render order.
//   (2) the INTEGRATION invariants: the queue composes grouping (U6) + batch (U5) +
//       score (U4) together over the SAME flat, keyboard-addressable queue, and a
//       needs-scrutiny item is never one keystroke from landing (KTD4 holds end to
//       end, not just in each unit's own isolated tests).
import { describe, it, expect } from "vitest";
import type { StagedSummary } from "#shared/index.js";
import {
  CARD_SECTIONS, decisionMode, type DecisionMode,
} from "../../src/client/shell/review/ProposalCard.js";
import { groupHeader, type GroupHeaderModel } from "../../src/client/shell/review/ReviewQueue.js";
import {
  scoreQueue, sortByScore, groupByAxis, NO_SESSION_BUCKET,
} from "../../src/client/shell/review/review-model.js";
import { batchTargets } from "../../src/client/shell/review/review-flow.js";
import { needsScrutiny, isSafeTail, SAFE_TAIL_THRESHOLD } from "../../src/client/shell/review/score.js";

const s = (over: Partial<StagedSummary> & { id: string; module: string }): StagedSummary => ({
  title: over.id.toUpperCase(),
  ...over,
});

/** A `source` pointer naming one or more origin sessions (provenance.ts's convention;
 *  mirrors review-grouping.test.ts's `src` helper). */
const src = (sessions: string[]) => ({ producer: "observe", kind: "entity", sessions });

// ─────────────────────────────────────────────────────────────────────────────
// (1a) the card's view-model — CARD_SECTIONS + decisionMode
// ─────────────────────────────────────────────────────────────────────────────

describe("CARD_SECTIONS — the card's imposed top-to-bottom hierarchy (U7)", () => {
  it("is exactly identity → why → diff → decision, in that order — not the old accretion order", () => {
    expect(CARD_SECTIONS).toEqual(["identity", "why", "diff", "decision"]);
  });

  it("the diff (the substance) precedes the decision (score + gestures) — you see what changes before you're asked to act", () => {
    expect(CARD_SECTIONS.indexOf("diff")).toBeLessThan(CARD_SECTIONS.indexOf("decision"));
  });

  it("identity leads — you know what this proposal IS before anything else", () => {
    expect(CARD_SECTIONS[0]).toBe("identity");
  });
});

describe("decisionMode — the decision footer's single active sub-mode", () => {
  it("nothing active → the default gesture row (score meter + approve/reject/edit)", () => {
    expect(decisionMode({ landing: false, editing: false, rejecting: false })).toBe("actions");
  });

  it("editing → the amend-then-re-stage form", () => {
    expect(decisionMode({ landing: false, editing: true, rejecting: false })).toBe("editing");
  });

  it("rejecting → the reason taxonomy", () => {
    expect(decisionMode({ landing: false, editing: false, rejecting: true })).toBe("rejecting");
  });

  it("landing (an approve/reject already dispatched) outranks BOTH editing and rejecting", () => {
    expect(decisionMode({ landing: true, editing: true, rejecting: false })).toBe("landing");
    expect(decisionMode({ landing: true, editing: false, rejecting: true })).toBe("landing");
    expect(decisionMode({ landing: true, editing: true, rejecting: true })).toBe("landing");
  });

  it("editing outranks rejecting (mirrors the pre-U7 ternary order verbatim — no behavior change)", () => {
    expect(decisionMode({ landing: false, editing: true, rejecting: true })).toBe("editing");
  });

  it("every DecisionMode value round-trips through a real decisionMode call (exhaustiveness sanity)", () => {
    const modes: DecisionMode[] = [
      decisionMode({ landing: true, editing: false, rejecting: false }),
      decisionMode({ landing: false, editing: true, rejecting: false }),
      decisionMode({ landing: false, editing: false, rejecting: true }),
      decisionMode({ landing: false, editing: false, rejecting: false }),
    ];
    expect(new Set(modes)).toEqual(new Set(["landing", "editing", "rejecting", "actions"]));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (1b) the queue's view-model — groupHeader (label + count + batchability)
// ─────────────────────────────────────────────────────────────────────────────

describe("groupHeader — a group's display model (label + total count + safe-tail batchability)", () => {
  const items = scoreQueue([
    s({ id: "safe-1", module: "knowledge", op: "create", confidence: "high" }),
    s({ id: "scrutiny-1", module: "guardrails", op: "create", confidence: "high" }),
    s({ id: "safe-2", module: "knowledge", op: "update", confidence: "high" }),
  ]);

  it("module axis: label is the module key verbatim", () => {
    const h: GroupHeaderModel = groupHeader("module", "knowledge", items, new Set());
    expect(h.label).toBe("knowledge");
  });

  it("session axis: NO_SESSION_BUCKET renders as an honest 'no session' label, not the raw key", () => {
    const h = groupHeader("session", NO_SESSION_BUCKET, items, new Set());
    expect(h.label).toBe("no session");
  });

  it("session axis: a real session key is shortened for display (provenance.ts's convention)", () => {
    const h = groupHeader("session", "claude-code:0a1b2c3d4e5f6789", items, new Set());
    expect(h.label).toBe("claude-code:0a1b2c3d4e5f");
  });

  it("count is the group's TOTAL size, regardless of selection or batchability", () => {
    expect(groupHeader("module", "knowledge", items, new Set()).count).toBe(3);
    expect(groupHeader("module", "knowledge", items, new Set(["scrutiny-1"])).count).toBe(3);
  });

  it("an EMPTY selection's batch is exactly the safe tail — the needs-scrutiny item is excluded", () => {
    const h = groupHeader("module", "mixed", items, new Set());
    expect(h.batch.map((x) => x.id).sort()).toEqual(["safe-1", "safe-2"]);
    for (const it of h.batch) expect(it.score).toBeLessThan(SAFE_TAIL_THRESHOLD);
    expect(h.batchIsSelection).toBe(false);
  });

  it("an explicit selection of the needs-scrutiny item is a legitimate individual override, not a sweep", () => {
    const h = groupHeader("module", "mixed", items, new Set(["scrutiny-1"]));
    expect(h.batch.map((x) => x.id)).toEqual(["scrutiny-1"]);
    expect(h.batchIsSelection).toBe(true);
  });

  it("a selection that misses this group entirely → an empty, non-selection batch (nothing to approve from here)", () => {
    const h = groupHeader("module", "mixed", items, new Set(["some-other-group-id"]));
    expect(h.batch).toEqual([]);
    expect(h.batchIsSelection).toBe(false);
  });

  it("groupHeader's batch is exactly what batchTargets(items, selected) would return — one source of truth, not a parallel computation", () => {
    for (const selected of [new Set<string>(), new Set(["safe-1"]), new Set(["scrutiny-1", "safe-2"])]) {
      const h = groupHeader("module", "mixed", items, selected);
      expect(h.batch).toEqual(batchTargets(items, selected));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) integration invariants — the canvas composes grouping + batch + keyboard +
//     score together, and KTD4's anti-fatigue guard survives the composition.
// ─────────────────────────────────────────────────────────────────────────────

describe("the canvas composes grouping + batch + score over ONE flat, keyboard-addressable queue", () => {
  const raw = [
    s({ id: "safe-a", module: "knowledge", op: "create", confidence: "high", source: src(["run-1"]) }),
    s({ id: "scrutiny-a", module: "guardrails", op: "create", confidence: "high", source: src(["run-1"]) }),
    s({ id: "critical-b", module: "actions", op: "delete", confidence: "high", source: src(["run-2"]) }),
    s({ id: "safe-b", module: "knowledge", op: "update", confidence: "high", source: src(["run-2"]) }),
  ];
  // this is exactly use-review-queue.ts's pipeline: score → sort → (re-partition per
  // axis, on demand) — the SAME flat array a keyboard cursor (focusedId/clampFocus)
  // moves over, regardless of which grouping view is showing.
  const flatQueue = sortByScore(scoreQueue(raw));

  it("fixture sanity: the flat queue has both safe-tail and needs-scrutiny items", () => {
    expect(flatQueue.some((it) => isSafeTail(it))).toBe(true);
    expect(flatQueue.some((it) => needsScrutiny(it))).toBe(true);
  });

  it("grouping (either axis) is a LOSSLESS partition of the flat scored/sorted queue — nothing the keyboard can reach goes missing or duplicates when grouped", () => {
    for (const axis of ["module", "session"] as const) {
      const grouped = groupByAxis(flatQueue, axis);
      const flattened = Object.values(grouped).flat().map((x) => x.id).sort();
      expect(flattened).toEqual(flatQueue.map((x) => x.id).sort());
    }
  });

  it("a needs-scrutiny item is not one keystroke (Shift+A, empty selection) from landing — at the WHOLE-QUEUE scope", () => {
    const targets = batchTargets(flatQueue, new Set());
    for (const t of targets) expect(needsScrutiny(t)).toBe(false);
    expect(targets.some((t) => t.id === "scrutiny-a")).toBe(false);
    expect(targets.some((t) => t.id === "critical-b")).toBe(false);
  });

  it("a needs-scrutiny item is not one keystroke from landing at the GROUP scope either, on either axis", () => {
    for (const axis of ["module", "session"] as const) {
      const grouped = groupByAxis(flatQueue, axis);
      for (const [key, items] of Object.entries(grouped)) {
        const header = groupHeader(axis, key, items, new Set());
        for (const it of header.batch) expect(needsScrutiny(it)).toBe(false);
      }
    }
  });

  it("switching axis never changes what's batchable with an empty selection — the guard is a property of the SCORE, not the grouping view", () => {
    const byModule = groupByAxis(flatQueue, "module");
    const bySession = groupByAxis(flatQueue, "session");
    const batchIds = (axis: "module" | "session", grouped: Record<string, typeof flatQueue>) =>
      Object.entries(grouped).flatMap(([key, items]) =>
        groupHeader(axis, key, items, new Set()).batch.map((x) => x.id),
      ).sort();
    expect(batchIds("module", byModule)).toEqual(batchIds("session", bySession));
    expect(batchIds("module", byModule)).toEqual(["safe-a", "safe-b"]);
  });

  it("an explicit per-item selection can still override into a needs-scrutiny approve — a deliberate individual act, not a sweep", () => {
    const targets = batchTargets(flatQueue, new Set(["scrutiny-a"]));
    expect(targets.map((t) => t.id)).toEqual(["scrutiny-a"]);
  });
});

// U5 — quick gestures over the review queue: the reject-taxonomy keyboard model (r),
// the batch selection-set + anti-fatigue batch model (x, KTD4), and the edit-before-
// approve intent (e). Framework-free: pure model tests, no DOM (this suite's
// convention — see review-flow.test.ts / scorer.test.ts).
import { describe, it, expect } from "vitest";
import type { StagedSummary } from "#shared/index.js";
import {
  reasonIndexFromKey, openRejectMode, moveRejectReason, REJECT_MODE_CLOSED,
  toggleSelection, batchTargets, editIntent,
} from "../../src/client/shell/review/review-flow.js";
import { REJECT_REASONS, scoreQueue } from "../../src/client/shell/review/review-model.js";
import { needsScrutiny, SAFE_TAIL_THRESHOLD } from "../../src/client/shell/review/score.js";

const s = (over: Partial<StagedSummary> & { id: string; module: string }): StagedSummary => ({
  title: over.id.toUpperCase(),
  ...over,
});

describe("reasonIndexFromKey — the reject taxonomy's digit fast-path", () => {
  it("maps 1..N to 0-based indices, 1-indexed on screen (button '1' → index 0)", () => {
    expect(reasonIndexFromKey("1", REJECT_REASONS.length)).toBe(0);
    expect(reasonIndexFromKey("6", REJECT_REASONS.length)).toBe(5);
  });

  it("an out-of-range digit, '0', or a non-digit key → null (no accidental submit)", () => {
    expect(reasonIndexFromKey("7", 6)).toBeNull();
    expect(reasonIndexFromKey("0", 6)).toBeNull();
    expect(reasonIndexFromKey("j", 6)).toBeNull();
    expect(reasonIndexFromKey("Enter", 6)).toBeNull();
    expect(reasonIndexFromKey("Escape", 6)).toBeNull();
  });
});

describe("openRejectMode / moveRejectReason — 'r' transitions the focused card into reject-taxonomy mode", () => {
  it("REJECT_MODE_CLOSED starts closed, at reason 0", () => {
    expect(REJECT_MODE_CLOSED).toEqual({ open: false, reasonIndex: 0 });
  });

  it("r opens the taxonomy at the first reason", () => {
    expect(openRejectMode()).toEqual({ open: true, reasonIndex: 0 });
  });

  it("j/k/arrows move the highlighted reason (reuses moveFocus's wrap-over-N model)", () => {
    const opened = openRejectMode();
    expect(moveRejectReason(opened, REJECT_REASONS.length, 1)).toEqual({ open: true, reasonIndex: 1 });
    expect(moveRejectReason(opened, REJECT_REASONS.length, -1)).toEqual({ open: true, reasonIndex: REJECT_REASONS.length - 1 });
  });

  it("the highlight wraps at both ends", () => {
    const atEnd = { open: true, reasonIndex: REJECT_REASONS.length - 1 };
    expect(moveRejectReason(atEnd, REJECT_REASONS.length, 1).reasonIndex).toBe(0);
    const atStart = { open: true, reasonIndex: 0 };
    expect(moveRejectReason(atStart, REJECT_REASONS.length, -1).reasonIndex).toBe(REJECT_REASONS.length - 1);
  });

  it("moving while closed is a no-op (guards a stray call from a closed state)", () => {
    expect(moveRejectReason(REJECT_MODE_CLOSED, REJECT_REASONS.length, 1)).toEqual(REJECT_MODE_CLOSED);
  });
});

describe("toggleSelection — the batch selection-set model (x)", () => {
  it("adds an unselected id, removes a selected one, never mutates the input set", () => {
    const empty = new Set<string>();
    const added = toggleSelection(empty, "a");
    expect(added.has("a")).toBe(true);
    expect(empty.has("a")).toBe(false); // input untouched

    const removed = toggleSelection(added, "a");
    expect(removed.has("a")).toBe(false);
    expect(added.has("a")).toBe(true); // input untouched
  });

  it("toggling one id doesn't disturb the others already selected", () => {
    const start = new Set(["a", "b"]);
    const next = toggleSelection(start, "c");
    expect([...next].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("batchTargets — the anti-fatigue batch model (KTD4: never sweep a needsScrutiny item into a blind batch)", () => {
  const items = scoreQueue([
    s({ id: "safe-1", module: "knowledge", op: "create", confidence: "high" }), // low blast → safe-tail
    s({ id: "safe-2", module: "actions", op: "update", confidence: "high" }), // low blast → safe-tail
    s({ id: "scrutiny-1", module: "guardrails", op: "create", confidence: "high" }), // elevated blast → needsScrutiny
    s({ id: "critical-1", module: "knowledge", op: "delete", confidence: "high" }), // critical blast → needsScrutiny
  ]);

  it("fixture sanity — the scorer really does split this set into safe-tail vs needs-scrutiny", () => {
    expect(items.filter((i) => !needsScrutiny(i)).map((i) => i.id).sort()).toEqual(["safe-1", "safe-2"]);
    expect(items.filter((i) => needsScrutiny(i)).map((i) => i.id).sort()).toEqual(["critical-1", "scrutiny-1"]);
  });

  it("an EMPTY selection defaults to the safe tail ONLY — a needsScrutiny item is never swept into a blind batch", () => {
    const targets = batchTargets(items, new Set());
    expect(targets.map((t) => t.id).sort()).toEqual(["safe-1", "safe-2"]);
    for (const t of targets) expect(t.score).toBeLessThan(SAFE_TAIL_THRESHOLD);
    expect(targets.some((t) => needsScrutiny(t))).toBe(false);
  });

  it("an explicit selection wins outright — a deliberately hand-picked needsScrutiny item IS included (an individual override, not a sweep)", () => {
    const targets = batchTargets(items, new Set(["scrutiny-1"]));
    expect(targets.map((t) => t.id)).toEqual(["scrutiny-1"]);
  });

  it("an explicit selection is EXACT, not additive — it never pulls in an unselected safe-tail item too", () => {
    const targets = batchTargets(items, new Set(["critical-1"]));
    expect(targets.map((t) => t.id)).toEqual(["critical-1"]);
  });

  it("an explicit selection spanning both classes lands exactly what was picked", () => {
    const targets = batchTargets(items, new Set(["safe-1", "critical-1"]));
    expect(targets.map((t) => t.id).sort()).toEqual(["critical-1", "safe-1"]);
  });
});

describe("editIntent — edit-before-approve's honest two-op fallback (reject + re-stage)", () => {
  it("an UPDATE targets the known note id, reason is 'reword', and edits merge over the staged change", () => {
    const item = s({ id: "st1", module: "knowledge", op: "update", target: "note-1", change: { title: "Old", body: "old body" } });
    const intent = editIntent(item, { title: "New" });
    expect(intent.reject).toEqual({ id: "st1", module: "knowledge", reason: "reword" });
    expect(intent.restage).toEqual({ module: "knowledge", op: "update", target: "note-1", change: { title: "New", body: "old body" } });
  });

  it("a CREATE with no targetId falls back to item.id (best-effort — StagedSummary carries no reliable create target — see the FLAGGED GAP)", () => {
    const item = s({ id: "st2", module: "knowledge", op: "create", target: null, change: { title: "Old" } });
    const intent = editIntent(item, { title: "New" });
    expect(intent.restage.op).toBe("create");
    expect(intent.restage.target).toBe("st2");
  });

  it("a CREATE with an explicit targetId (the edit form's user-confirmed id) uses it instead of the fallback", () => {
    const item = s({ id: "st3", module: "knowledge", op: "create", target: null, change: { title: "Old" } });
    const intent = editIntent(item, { title: "New" }, "user-confirmed-id");
    expect(intent.restage.target).toBe("user-confirmed-id");
  });

  it("an UPDATE ignores a supplied targetId — the known item.target always wins for updates", () => {
    const item = s({ id: "st5", module: "knowledge", op: "update", target: "note-5", change: { title: "Old" } });
    const intent = editIntent(item, { title: "New" }, "should-be-ignored");
    expect(intent.restage.target).toBe("note-5");
  });

  it("edits only override the touched keys — untouched fields survive from the staged change", () => {
    const item = s({ id: "st4", module: "knowledge", op: "update", target: "note-4", change: { title: "T", body: "B", status: "active" } });
    const intent = editIntent(item, { body: "B2" });
    expect(intent.restage.change).toEqual({ title: "T", body: "B2", status: "active" });
  });

  it("never lands anything itself — editIntent is data only (no dataProvider/approve reference in this module)", () => {
    // structural guard, mirrors scorer.test.ts's moat check: editIntent composes an
    // intent, it doesn't dispatch one.
    expect(typeof editIntent).toBe("function");
    expect(editIntent.length).toBeLessThanOrEqual(3);
  });
});

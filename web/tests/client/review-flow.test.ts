// P2.4 — the focused decision flow over the review queue.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { StagedSummary } from "../../src/shared/index.js";
import {
  clampFocus, moveFocus, focusedId, orderForApply, runBatchApprove, shouldAutoCloseReview,
} from "../../src/client/shell/review/review-flow.js";

const q = (n: number): StagedSummary[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, module: "m", title: `t${i}` }));

describe("clampFocus", () => {
  it("empty → -1", () => expect(clampFocus(0, 3)).toBe(-1));
  it("clamps over/under into range", () => {
    expect(clampFocus(3, 9)).toBe(2);
    expect(clampFocus(3, -5)).toBe(0);
    expect(clampFocus(3, 1)).toBe(1);
  });
});

describe("moveFocus", () => {
  it("empty → -1", () => expect(moveFocus(0, 0, 1)).toBe(-1));
  it("wraps forward and backward", () => {
    expect(moveFocus(3, 2, 1)).toBe(0);
    expect(moveFocus(3, 0, -1)).toBe(2);
    expect(moveFocus(3, 1, 1)).toBe(2);
  });
  it("an unset cursor (-1) starts at the first item", () => {
    expect(moveFocus(3, -1, 1)).toBe(1);
    expect(moveFocus(3, -1, -1)).toBe(2);
  });
});

describe("focusedId", () => {
  it("returns the id at the cursor, null out of range", () => {
    expect(focusedId(q(3), 1)).toBe("s1");
    expect(focusedId(q(3), -1)).toBeNull();
    expect(focusedId(q(3), 9)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug fix — the batch APPLY order: a from-scratch build stages a note's CREATE
// alongside an UPDATE/DELETE/DEPRECATE that targets it, in the SAME batch. The
// queue's display order (blast-radius-sorted) used to double as the apply order,
// so the mutation could dispatch before its target's create had landed and fail
// ("Approved 29 of 31 — 2 failed to land"). `orderForApply` fixes the APPLY order
// only: create=0, update=1, delete/deprecate=2, stable within a phase.
// ─────────────────────────────────────────────────────────────────────────────

describe("orderForApply — create before update before delete/deprecate, stable within a phase", () => {
  const item = (id: string, op?: string) => ({ id, module: "m", op });

  it("puts creates before updates before deletes/deprecates, preserving intra-phase (first-seen) order", () => {
    const items = [
      item("delete-1", "delete"),
      item("create-1", "create"),
      item("update-1", "update"),
      item("deprecate-1", "deprecate"),
      item("create-2", "create"),
      item("update-2", "update"),
    ];
    expect(orderForApply(items).map((x) => x.id)).toEqual([
      "create-1", "create-2",
      "update-1", "update-2",
      "delete-1", "deprecate-1",
    ]);
  });

  it("the observed bug, reduced: a batch of [update-on-X, create-X] applies create-X first", () => {
    const items = [item("update-x", "update"), item("create-x", "create")];
    expect(orderForApply(items).map((x) => x.id)).toEqual(["create-x", "update-x"]);
  });

  it("a batch of all creates is unchanged — nothing to reorder", () => {
    const items = [item("c1", "create"), item("c2", "create"), item("c3", "create")];
    expect(orderForApply(items).map((x) => x.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("deletes and deprecates always come last, after every create and update", () => {
    const items = [
      item("delete-1", "delete"),
      item("create-1", "create"),
      item("deprecate-1", "deprecate"),
      item("update-1", "update"),
    ];
    const ordered = orderForApply(items).map((x) => x.id);
    expect(ordered.indexOf("create-1")).toBeLessThan(ordered.indexOf("delete-1"));
    expect(ordered.indexOf("create-1")).toBeLessThan(ordered.indexOf("deprecate-1"));
    expect(ordered.indexOf("update-1")).toBeLessThan(ordered.indexOf("delete-1"));
    expect(ordered.indexOf("update-1")).toBeLessThan(ordered.indexOf("deprecate-1"));
  });

  it("an absent op defaults to create (mirrors diff.ts/score.ts's own convention) — sorts alongside real creates, not after them", () => {
    const items = [item("delete-1", "delete"), item("untagged")];
    expect(orderForApply(items).map((x) => x.id)).toEqual(["untagged", "delete-1"]);
  });

  it("never mutates the input array (pure)", () => {
    const items = [item("delete-1", "delete"), item("create-1", "create")];
    const copy = [...items];
    orderForApply(items);
    expect(items).toEqual(copy);
  });
});

describe("runBatchApprove consumes the ordered list — dispatch follows orderForApply, not the caller's raw order", () => {
  it("dispatches create-x before update-x even when the caller passes update-x first — the from-scratch scenario", async () => {
    const callOrder: string[] = [];
    const approveOne = async (id: string, _module: string) => { callOrder.push(id); return true; };
    const targets = [
      { id: "update-x", module: "m", op: "update" },
      { id: "create-x", module: "m", op: "create" },
    ];
    await runBatchApprove(targets, approveOne);
    expect(callOrder).toEqual(["create-x", "update-x"]);
  });

  it("a full mixed batch dispatches in create → update → delete/deprecate phase order", async () => {
    const callOrder: string[] = [];
    const approveOne = async (id: string, _module: string) => { callOrder.push(id); return true; };
    const targets = [
      { id: "delete-1", module: "m", op: "delete" },
      { id: "update-1", module: "m", op: "update" },
      { id: "create-1", module: "m", op: "create" },
      { id: "deprecate-1", module: "m", op: "deprecate" },
      { id: "create-2", module: "m", op: "create" },
    ];
    await runBatchApprove(targets, approveOne);
    expect(callOrder).toEqual(["create-1", "create-2", "update-1", "delete-1", "deprecate-1"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// U6 (curried-plotting-coral.md) — auto-close the review OVERLAY when the queue
// empties. Bug fix: approving/rejecting the last pending proposal used to leave an
// empty review overlay sitting open — nothing ever dismissed it. `shouldAutoCloseReview`
// is the pure trigger the ReviewQueue.tsx consumer schedules a gentle, cancellable
// timeout off of; ONLY the overlay instance (never the session wing's own
// <ReviewQueue>) should ever self-close.
// ─────────────────────────────────────────────────────────────────────────────

describe("shouldAutoCloseReview — the auto-close trigger", () => {
  it("fires only for the OVERLAY instance, once settled at zero", () => {
    expect(shouldAutoCloseReview(true, false, 0)).toBe(true);
  });

  it("never fires for the wing instance (overlay=false), even at zero", () => {
    expect(shouldAutoCloseReview(false, false, 0)).toBe(false);
  });

  it("never fires while still loading — a loading flicker (total transiently 0 before the first fetch resolves) must not close anything", () => {
    expect(shouldAutoCloseReview(true, true, 0)).toBe(false);
  });

  it("never fires while the queue still has pending items", () => {
    expect(shouldAutoCloseReview(true, false, 1)).toBe(false);
    expect(shouldAutoCloseReview(true, false, 12)).toBe(false);
  });

  it("all three gates must hold at once — overlay AND settled AND empty", () => {
    expect(shouldAutoCloseReview(false, true, 3)).toBe(false);
    expect(shouldAutoCloseReview(true, true, 3)).toBe(false);
    expect(shouldAutoCloseReview(false, false, 0)).toBe(false);
  });
});

describe("ReviewQueue.tsx / WorkbenchShell.tsx source wiring — the gentle, cancellable auto-close", () => {
  const queueSrc = readFileSync(fileURLToPath(new URL("../../src/client/shell/review/ReviewQueue.tsx", import.meta.url)), "utf8");
  const shellSrc = readFileSync(fileURLToPath(new URL("../../src/client/shell/WorkbenchShell.tsx", import.meta.url)), "utf8");

  it("ReviewQueue accepts an `overlay` flag, distinct from `keyboard`", () => {
    expect(queueSrc).toMatch(/export function ReviewQueue\(\{ keyboard, overlay \}: \{ keyboard\?: boolean; overlay\?: boolean \} = \{\}\)/);
  });

  it("schedules the close via setTimeout (cancellable — a fresh proposal streaming in within the window cancels it), not an immediate call", () => {
    expect(queueSrc).toMatch(/if \(!shouldAutoCloseReview\(!!overlay, loading, total\)\) return;/);
    expect(queueSrc).toMatch(/const t = setTimeout\(\(\) => setReviewOpen\(false\), AUTO_CLOSE_DELAY_MS\);/);
    expect(queueSrc).toMatch(/return \(\) => clearTimeout\(t\);/);
  });

  it("WorkbenchShell passes `overlay` ONLY on the fixed overlay instance, never on the session wing's <ReviewQueue>", () => {
    expect(shellSrc).toMatch(/<ReviewQueue keyboard overlay \/>/);
    expect(shellSrc).toMatch(/<ReviewQueue keyboard=\{!reviewOpen\} \/>/);
    expect(shellSrc).not.toMatch(/<ReviewQueue keyboard=\{!reviewOpen\} overlay/);
  });
});

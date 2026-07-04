// Bug fix — the stuck "landing…" card: approving/rejecting a proposal used to set the
// card's local `landing` flag and fire-and-forget the mutation, never listening for
// the outcome. When the daemon's commit FAILED (a resolved `{ok:false}` — see
// use-review-queue.ts's `softError`, or a thrown/rejected mutation either way), the
// card hung on "landing…" forever: no error shown, no way back to Approve/Reject, and
// a batch approve silently no-opped on a partial failure. Framework-free: pure
// model/view-model tests, no DOM (this suite's convention — see review-flow.test.ts /
// review-gestures.test.ts / hitl-canvas.test.ts). Mocks the approve call's
// resolve/reject and asserts the resulting view-model state, per the two pure
// contracts the fix introduces:
//   (1) ProposalCard.clearsLanding — the card's landing-flag transition on outcome.
//   (2) review-flow.ts's runBatchApprove/selectionAfterBatch — the batch model.
import { describe, it, expect } from "vitest";
import { decisionMode, clearsLanding } from "../../src/client/shell/review/ProposalCard.js";
import { runBatchApprove, selectionAfterBatch } from "../../src/client/shell/review/review-flow.js";

// ─────────────────────────────────────────────────────────────────────────────
// (1) the card's landing transition — a failed outcome un-sticks it
// ─────────────────────────────────────────────────────────────────────────────

describe("clearsLanding — the card's landing-flag transition on an approve/reject outcome", () => {
  it("a FAILED outcome clears landing (the fix: no more stuck 'landing…')", () => {
    expect(clearsLanding(false)).toBe(true);
  });

  it("a SUCCESSFUL outcome leaves landing set — the card unmounts once the queue's refetch drops it", () => {
    expect(clearsLanding(true)).toBe(false);
  });

  it("integration: an approve that rejects transitions the card OUT of 'landing' into 'actions' (actionable, not stuck)", () => {
    // click Approve: landing = true → decisionMode reads "landing"
    let landing = true;
    expect(decisionMode({ landing, editing: false, rejecting: false })).toBe("landing");

    // the mutation resolves false (the daemon refused it) — clearsLanding says clear it
    const ok = false;
    if (clearsLanding(ok)) landing = false;

    // the card is actionable again, not stuck
    expect(decisionMode({ landing, editing: false, rejecting: false })).toBe("actions");
  });

  it("integration: a successful approve leaves the card in 'landing' (it's expected to unmount, not revert to actions)", () => {
    let landing = true;
    const ok = true;
    if (clearsLanding(ok)) landing = false;
    expect(decisionMode({ landing, editing: false, rejecting: false })).toBe("landing");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) the batch model — per-item failures are reported, not swallowed
// ─────────────────────────────────────────────────────────────────────────────

/** A mocked approve: resolves `true`/`false` per id, OR throws for ids in `throws` —
 *  covers both failure shapes runBatchApprove must tolerate (a resolved `false` AND a
 *  rejected/thrown promise), per the task's "mock the approve call's resolve/reject". */
function mockApprove(outcomes: Record<string, boolean>, throwsFor: Set<string> = new Set()) {
  return async (id: string, _module: string): Promise<boolean> => {
    if (throwsFor.has(id)) throw new Error(`refused: ${id}`);
    return outcomes[id] ?? false;
  };
}

describe("runBatchApprove — awaits every target, partitions by outcome (the fix for the batch's silent no-op)", () => {
  it("all succeed → everything lands, nothing fails", async () => {
    const targets = [{ id: "a", module: "m" }, { id: "b", module: "m" }];
    const approveOne = mockApprove({ a: true, b: true });
    const result = await runBatchApprove(targets, approveOne);
    expect(result.succeeded.sort()).toEqual(["a", "b"]);
    expect(result.failed).toEqual([]);
  });

  it("a PARTIAL failure (resolved false) is reported, not silently dropped", async () => {
    const targets = [{ id: "a", module: "m" }, { id: "b", module: "m" }, { id: "c", module: "m" }];
    const approveOne = mockApprove({ a: true, b: false, c: true });
    const result = await runBatchApprove(targets, approveOne);
    expect(result.succeeded.sort()).toEqual(["a", "c"]);
    expect(result.failed).toEqual(["b"]);
  });

  it("a THROWN/rejected mutation counts as a failure too — never crashes the batch", async () => {
    const targets = [{ id: "a", module: "m" }, { id: "b", module: "m" }];
    const approveOne = mockApprove({ a: true }, new Set(["b"]));
    const result = await runBatchApprove(targets, approveOne);
    expect(result.succeeded).toEqual(["a"]);
    expect(result.failed).toEqual(["b"]);
  });

  it("one slow failure never blocks the rest of the batch from landing (Promise.all, not sequential)", async () => {
    const targets = [{ id: "slow-fail", module: "m" }, { id: "fast-ok", module: "m" }];
    const approveOne = async (id: string) => {
      if (id === "slow-fail") { await new Promise((r) => setTimeout(r, 5)); return false; }
      return true;
    };
    const result = await runBatchApprove(targets, approveOne);
    expect(result.succeeded).toEqual(["fast-ok"]);
    expect(result.failed).toEqual(["slow-fail"]);
  });

  it("an empty target list resolves to an empty, non-crashing result", async () => {
    const result = await runBatchApprove([], mockApprove({}));
    expect(result).toEqual({ succeeded: [], failed: [] });
  });
});

describe("selectionAfterBatch — success clears the item from selection; a failure stays selected", () => {
  it("succeeded ids drop out of the selection", () => {
    const selected = new Set(["a", "b", "c"]);
    const next = selectionAfterBatch(selected, ["a", "c"]);
    expect([...next].sort()).toEqual(["b"]);
  });

  it("a failed id (not in `succeeded`) stays selected — still pending, still actionable", () => {
    const selected = new Set(["a", "b"]);
    const next = selectionAfterBatch(selected, ["a"]); // b failed, wasn't in succeeded
    expect([...next]).toEqual(["b"]);
  });

  it("never mutates the input set (pure, mirrors toggleSelection's contract)", () => {
    const selected = new Set(["a", "b"]);
    selectionAfterBatch(selected, ["a"]);
    expect([...selected].sort()).toEqual(["a", "b"]);
  });

  it("succeeding on everything empties the selection", () => {
    const selected = new Set(["a", "b"]);
    const next = selectionAfterBatch(selected, ["a", "b"]);
    expect(next.size).toBe(0);
  });
});

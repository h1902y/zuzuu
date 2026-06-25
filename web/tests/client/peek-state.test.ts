// U8 logic — the slide-over peek reducer. Opening/dismissing peek must never touch
// the stage selection (the terminal keeps streaming) — that invariant lives in the
// shell wiring; here we test the peek state transitions in isolation.
import { describe, it, expect } from "vitest";
import { peekReducer, initialPeek, type PeekTarget } from "../../src/client/shell/peek-state.js";

const note: PeekTarget = { kind: "row", id: "auth", module: "knowledge" };
const table: PeekTarget = { kind: "module", id: "actions" };

describe("peek-state", () => {
  it("open sets {open, target}; dismiss clears it", () => {
    const opened = peekReducer(initialPeek, { type: "open", target: note });
    expect(opened).toEqual({ open: true, target: note });
    expect(peekReducer(opened, { type: "dismiss" })).toEqual(initialPeek);
  });

  it("opening a new target while open swaps the target", () => {
    const a = peekReducer(initialPeek, { type: "open", target: note });
    const b = peekReducer(a, { type: "open", target: table });
    expect(b).toEqual({ open: true, target: table });
  });
});

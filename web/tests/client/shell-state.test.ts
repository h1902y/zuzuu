// U1 — the shell state model: selection → actors, concurrency, ribbon. Pure logic.
// U3 (live-views plan, docs/plans/2026-07-04-002) extends this suite: noteOrFlowNav's
// view branch (mirroring its workflow branch) + selectActors' view case.
import { describe, it, expect } from "vitest";
import { selectActors, mostRecentlyActive, ribbonState, noteOrFlowNav, type SessionLite } from "../../src/client/shell/shell-state.js";

describe("selectActors — the selection → stage/wing morph (no modes)", () => {
  it("session → terminal + review wing", () => {
    expect(selectActors({ kind: "session", id: "s1" })).toEqual({ stage: "terminal", wing: "review", crumb: ["session", "s1"] });
  });
  it("module → grid + schema wing", () => {
    expect(selectActors({ kind: "module", id: "knowledge" })).toEqual({ stage: "grid", wing: "schema", crumb: ["knowledge"] });
  });
  it("row → record + form wing", () => {
    expect(selectActors({ kind: "row", id: "auth", module: "knowledge" })).toEqual({ stage: "record", wing: "form", crumb: ["knowledge", "auth"] });
  });
  it("home/default → THE MAP (map-first, C1); the retired Overview deep-links to it (§D)", () => {
    expect(selectActors({ kind: "overview" }).stage).toBe("world");
    expect(selectActors(null)).toEqual({ stage: "world", wing: "none", crumb: [] });
  });
  it("note → the World stays the stage, record opens as the wing (reading never leaves the map)", () => {
    expect(selectActors({ kind: "note", id: "auth", module: "knowledge" })).toEqual({ stage: "world", wing: "form", crumb: ["knowledge", "auth"] });
  });
  it("the whole-Project surfaces → their stage, wing retracts (settings is a DIALOG now — §D)", () => {
    expect(selectActors({ kind: "search" })).toEqual({ stage: "search", wing: "none", crumb: ["Search"] });
    expect(selectActors({ kind: "settings" })).toEqual({ stage: "world", wing: "none", crumb: [] });
  });
  it("acp session → the ACP conversation stage, wing retracts (short-id crumb)", () => {
    expect(selectActors({ kind: "acp", id: "abcdef1234" })).toEqual({ stage: "acp", wing: "none", crumb: ["Agent", "abcdef"] });
  });
  it("view (U3) → the live board stage, wing retracts (mirrors flow's no-wing posture)", () => {
    expect(selectActors({ kind: "view", module: "crm", id: "pipeline" })).toEqual({ stage: "view", wing: "none", crumb: ["crm", "pipeline"] });
  });
});

describe("noteOrFlowNav — U3 extends the workflow branch with a view branch (mirrored shape)", () => {
  it("a type:workflow node still focuses Flow (unchanged)", () => {
    expect(noteOrFlowNav("knowledge", "onboarding", true, "row")).toEqual({ kind: "flow", module: "knowledge", id: "onboarding" });
    expect(noteOrFlowNav("knowledge", "onboarding", true, "note")).toEqual({ kind: "flow", module: "knowledge", id: "onboarding" });
  });
  it("a type:view node focuses the ViewBoard — same seam, new kind", () => {
    expect(noteOrFlowNav("crm", "pipeline", false, "row", true)).toEqual({ kind: "view", module: "crm", id: "pipeline" });
    expect(noteOrFlowNav("crm", "pipeline", false, "note", true)).toEqual({ kind: "view", module: "crm", id: "pipeline" });
  });
  it("workflow wins over view if both flags were ever true (shouldn't happen — type is singular)", () => {
    expect(noteOrFlowNav("m", "x", true, "row", true)).toEqual({ kind: "flow", module: "m", id: "x" });
  });
  it("an ordinary note is unchanged: row → kind:row, note → kind:note (no regression)", () => {
    expect(noteOrFlowNav("knowledge", "auth", false, "row")).toEqual({ kind: "row", id: "auth", module: "knowledge" });
    expect(noteOrFlowNav("knowledge", "auth", false, "note")).toEqual({ kind: "note", id: "auth", module: "knowledge" });
  });
  it("isView defaults to false — existing 4-arg call sites (Grid/Everything/World) are unaffected", () => {
    expect(noteOrFlowNav("knowledge", "auth", false, "row")).toEqual({ kind: "row", id: "auth", module: "knowledge" });
  });
});

describe("mostRecentlyActive — concurrency: which session owns the single stage", () => {
  const s = (id: string, live: boolean, lastActiveAt?: number): SessionLite => ({ id, live, lastActiveAt });
  it("picks the most-recently-active live session; others are dots", () => {
    expect(mostRecentlyActive([s("a", true, 100), s("b", true, 300), s("c", false, 999)])).toBe("b");
  });
  it("null when nothing is live", () => {
    expect(mostRecentlyActive([s("a", false), s("b", false)])).toBeNull();
    expect(mostRecentlyActive([])).toBeNull();
  });
});

describe("ribbonState — the ambient gate", () => {
  it("counts live sessions + sums pending; allCaughtUp at zero", () => {
    const r = ribbonState([{ id: "a", live: true }, { id: "b", live: false }], { knowledge: 2, actions: 1 });
    expect(r).toEqual({ liveness: 1, pending: 3, allCaughtUp: false });
  });
  it("allCaughtUp true when nothing pending (calm empty state)", () => {
    expect(ribbonState([], {}).allCaughtUp).toBe(true);
    expect(ribbonState([{ id: "a", live: true }], { knowledge: 0 }).allCaughtUp).toBe(true);
  });
  it("never claims all-caught-up while setup is incomplete (bug fix)", () => {
    // nothing pending, but a setup rung is still open — must NOT read "all caught up"
    const r = ribbonState([], {}, true);
    expect(r.allCaughtUp).toBe(false);
    expect(r.pending).toBe(0);
  });
  it("setupIncomplete defaults to false — existing call sites are unaffected", () => {
    expect(ribbonState([], { knowledge: 2 }).allCaughtUp).toBe(false);
    expect(ribbonState([], { knowledge: 2 }).pending).toBe(2);
  });
});

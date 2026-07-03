// U1 — the shell state model: selection → actors, concurrency, ribbon. Pure logic.
import { describe, it, expect } from "vitest";
import { selectActors, mostRecentlyActive, ribbonState, type SessionLite } from "../../src/client/shell/shell-state.js";

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
});

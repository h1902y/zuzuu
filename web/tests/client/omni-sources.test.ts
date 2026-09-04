// omnibar/omni-sources.ts — proposals + saved-views sources (§E.1 stage 2).
// U4 (live-views plan, docs/plans/2026-07-04-002) extends the saved-views suite:
// run-view now resolves to the board nav (runViewNav), not the retired viewLens.
import { describe, it, expect } from "vitest";
import type { ModuleItem } from "#shared/index.js";
import { proposalsGroup, viewsGroup, runViewNav, selectionGroup } from "../../src/client/omnibar/omni-sources.js";

const item = (over: Partial<ModuleItem> & Record<string, unknown>): ModuleItem =>
  ({ id: "x", module: "m", kind: "concept", title: "", status: "", ...over }) as ModuleItem;

describe("proposalsGroup", () => {
  const staged = [
    { module: "knowledge", s: { id: "p1", module: "knowledge", title: "New rule", op: "create", target: "rule-x" } },
  ];

  it("rows carry the proposal lane, gate verbs on Tab, and a detail ref", () => {
    const g = proposalsGroup(staged)!;
    expect(g.heading).toBe("Proposals");
    const row = g.commands[0]!;
    expect(row.lane).toBe("proposal");
    expect(row.detail).toMatchObject({ kind: "proposal", module: "knowledge", id: "p1" });
    const verbs = row.actions!.map((a) => a.action.kind);
    expect(verbs).toEqual(["approve-proposal", "reject-proposal", "review"]);
    // the gate's decisions are the HUMAN acting — instant lane
    expect(row.actions![0]!.lane).toBe("instant");
  });

  it("empty queue → no group", () => {
    expect(proposalsGroup([])).toBeNull();
  });

  it("a non-array `staged` (a degraded fan-out response) → no group, never throws", () => {
    expect(() => proposalsGroup(undefined as unknown as typeof staged)).not.toThrow();
    expect(proposalsGroup(undefined as unknown as typeof staged)).toBeNull();
    expect(proposalsGroup(null as unknown as typeof staged)).toBeNull();
  });
});

describe("saved views (U4: run-view opens the full board, not a partial lens)", () => {
  const view = item({ id: "view-active", module: "actions", kind: "view", title: "Active work", query: { module: "actions", type: "activity", text: "" } });

  it("runViewNav resolves the view NOTE's own address to the board nav — the note's OWN module/id, even when its query names a different module (ViewBoard, not the omnibar, resolves the query's target scope)", () => {
    expect(runViewNav(view)).toEqual({ kind: "view", module: "actions", id: "view-active" });
    const crossModule = item({ id: "cross", module: "actions", kind: "view", query: { module: "crm", "group-by": "stage" } });
    expect(runViewNav(crossModule)).toEqual({ kind: "view", module: "actions", id: "cross" });
  });

  it("viewsGroup lists only view notes; its run-view action resolves to the board nav (kind:view, correct module/id), NOT the retired module-filter lens", () => {
    const g = viewsGroup([view, item({ id: "n1" })], "")!;
    expect(g.commands).toHaveLength(1);
    expect(g.commands[0]!.action).toEqual({ kind: "run-view", module: "actions", id: "view-active" });
    expect(viewsGroup([view], "zzz")).toBeNull();
    expect(viewsGroup([item({ id: "n1" })], "")).toBeNull();
  });

  it("a view with where + group-by resolves to the same minimal board nav — the board reads the query FROM the note by module/id lookup, so the omnibar never re-serializes where/group-by/sort", () => {
    const pipeline = item({
      id: "pipeline",
      module: "crm",
      kind: "view",
      title: "Pipeline by stage",
      query: { module: "crm", where: ["stage!=lost"], "group-by": "stage", sort: "priority" },
    });
    const g = viewsGroup([pipeline], "")!;
    expect(g.commands[0]!.action).toEqual({ kind: "run-view", module: "crm", id: "pipeline" });
  });

  it("a non-array `items` (a degraded fan-out response) → no group, never throws", () => {
    expect(() => viewsGroup(undefined as unknown as ModuleItem[], "")).not.toThrow();
    expect(viewsGroup(undefined as unknown as ModuleItem[], "")).toBeNull();
    expect(viewsGroup(null as unknown as ModuleItem[], "")).toBeNull();
  });
});

describe("selectionGroup — §H.3.4: selection is context, the omnibar is the verb", () => {
  it("no selection → no group", () => {
    expect(selectionGroup(0)).toBeNull();
  });

  it("two verbs this pass — export and delete — are BOTH instant (S1: the operator's delete is never the review gate) and carry the count in the label", () => {
    const g = selectionGroup(3)!;
    expect(g.heading).toBe("Selection");
    expect(g.commands.map((c) => c.label)).toEqual(["Export 3 as CSV", "Delete 3 selected"]);
    expect(g.commands.map((c) => c.lane)).toEqual(["instant", "instant"]);
    // delete routes through the two-step in-omnibar count-confirm, not straight to a write
    expect(g.commands.map((c) => c.action.kind)).toEqual(["export-selection", "delete-selection-confirm"]);
  });
});

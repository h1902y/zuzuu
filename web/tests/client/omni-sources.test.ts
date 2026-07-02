// omnibar/omni-sources.ts — proposals + saved-views sources (§E.1 stage 2).
import { describe, it, expect } from "vitest";
import type { ModuleItem } from "#shared/index.js";
import { proposalsGroup, viewsGroup, viewLens } from "../../src/client/omnibar/omni-sources.js";

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
});

describe("saved views", () => {
  const view = item({ id: "view-active", module: "actions", kind: "view", title: "Active work", query: { module: "actions", type: "activity", text: "" } });

  it("viewLens maps the note's query onto the shared lens axes only", () => {
    expect(viewLens(view)).toEqual({ module: "actions", text: "", noteKind: "activity" });
    expect(viewLens(item({ kind: "view" }))).toEqual({ module: "", text: "", noteKind: "" });
  });

  it("viewsGroup lists only view notes; run carries the lens; query filters", () => {
    const g = viewsGroup([view, item({ id: "n1" })], "")!;
    expect(g.commands).toHaveLength(1);
    expect(g.commands[0]!.action).toMatchObject({ kind: "run-view", module: "actions", noteKind: "activity" });
    expect(viewsGroup([view], "zzz")).toBeNull();
    expect(viewsGroup([item({ id: "n1" })], "")).toBeNull();
  });
});

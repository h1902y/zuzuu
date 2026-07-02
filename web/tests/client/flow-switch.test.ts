// The Flow toggle's pure targeting logic — where >flow / the header button lands.
import { describe, it, expect } from "vitest";
import { flowTarget, isWorkflowAddr } from "../../src/client/shell/stage/flow-switch.js";
import { noteOrFlowNav } from "../../src/client/shell/shell-state.js";

const addrs = new Set(["actions:onboard-lead", "crm:enrich"]);

describe("flowTarget — where the Flow toggle/palette navigates", () => {
  it("already on a focused Flow stage → stays there", () => {
    expect(flowTarget({ kind: "flow", module: "actions", id: "onboard-lead" }, addrs))
      .toEqual({ module: "actions", id: "onboard-lead" });
  });
  it("Flow home (no module/id) is not a target — falls through", () => {
    expect(flowTarget({ kind: "flow" }, addrs)).toBeNull();
  });
  it("a selected note that IS a known workflow focuses Flow on it", () => {
    expect(flowTarget({ kind: "note", id: "onboard-lead", module: "actions" }, addrs))
      .toEqual({ module: "actions", id: "onboard-lead" });
  });
  it("a selected row that IS a known workflow focuses Flow on it", () => {
    expect(flowTarget({ kind: "row", id: "enrich", module: "crm" }, addrs))
      .toEqual({ module: "crm", id: "enrich" });
  });
  it("a selected note that is NOT a workflow → null (Flow home)", () => {
    expect(flowTarget({ kind: "note", id: "brahman", module: "knowledge" }, addrs)).toBeNull();
  });
  it("no selection at all → null (Flow home)", () => {
    expect(flowTarget(null, addrs)).toBeNull();
  });
  it("a module/everything/session selection → null (Flow home, no workflow in context)", () => {
    expect(flowTarget({ kind: "module", id: "actions" }, addrs)).toBeNull();
    expect(flowTarget({ kind: "everything" }, addrs)).toBeNull();
    expect(flowTarget({ kind: "session", id: "s1" }, addrs)).toBeNull();
  });
});

describe("isWorkflowAddr", () => {
  it("true for a known workflow addr", () => expect(isWorkflowAddr("actions", "onboard-lead", addrs)).toBe(true));
  it("false for anything else", () => expect(isWorkflowAddr("knowledge", "brahman", addrs)).toBe(false));
});

describe("noteOrFlowNav — map/table selection routes a workflow note to Flow", () => {
  it("a workflow note → the Flow NavNode, regardless of asNote", () => {
    expect(noteOrFlowNav("actions", "onboard-lead", true, "note")).toEqual({ kind: "flow", module: "actions", id: "onboard-lead" });
    expect(noteOrFlowNav("actions", "onboard-lead", true, "row")).toEqual({ kind: "flow", module: "actions", id: "onboard-lead" });
  });
  it("a non-workflow note, asNote 'note' → the map-first note NavNode", () => {
    expect(noteOrFlowNav("knowledge", "brahman", false, "note")).toEqual({ kind: "note", id: "brahman", module: "knowledge" });
  });
  it("a non-workflow note, asNote 'row' → the Record-stage row NavNode", () => {
    expect(noteOrFlowNav("knowledge", "brahman", false, "row")).toEqual({ kind: "row", id: "brahman", module: "knowledge" });
  });
});

// The Flow projection's pure model — topo-layer assignment, the layout geometry,
// and the run-state → node-style overlay join. No DOM; Flow.tsx renders this.
import { describe, it, expect } from "vitest";
import {
  stepKind, dependsOn, assignLayers, layoutFlow, edgePath,
  runStepRing, overlayRunState, runProgress, compensationFired, flowGrid, waitBadgeSignal,
  NODE_W, NODE_H, LAYER_DX, NODE_DY,
  type FlowStepDef,
} from "../../src/client/shell/stage/flow-graph.js";

describe("stepKind — the closed run|note|wait vocabulary", () => {
  it("run: a shell step", () => {
    expect(stepKind({ id: "a", run: "true" })).toBe("run");
  });
  it("note: a note-ref step", () => {
    expect(stepKind({ id: "a", note: "actions:other" })).toBe("note");
  });
  it("wait: a pause step with a signal name", () => {
    expect(stepKind({ id: "a", wait: { on: "approval" } })).toBe("wait");
  });
  it("invalid: neither run/note/wait", () => {
    expect(stepKind({ id: "a" })).toBe("invalid");
  });
  it("invalid: both run and note", () => {
    expect(stepKind({ id: "a", run: "true", note: "actions:x" })).toBe("invalid");
  });
  it("invalid: a wait with no `on`", () => {
    expect(stepKind({ id: "a", wait: {} })).toBe("invalid");
  });
  it("invalid: a blank run string doesn't count as set", () => {
    expect(stepKind({ id: "a", run: "   " })).toBe("invalid");
  });
});

describe("dependsOn — normalizes the bare-string-or-list frontmatter shape", () => {
  it("absent → []", () => expect(dependsOn({ id: "a", run: "true" })).toEqual([]));
  it("a bare string → [that]", () => expect(dependsOn({ id: "a", run: "true", "depends-on": "b" })).toEqual(["b"]));
  it("a block list → itself, blanks dropped", () => expect(dependsOn({ id: "a", run: "true", "depends-on": ["b", "", "c"] })).toEqual(["b", "c"]));
});

describe("assignLayers — longest-path-from-roots topo layering", () => {
  it("a root with no deps sits at layer 0", () => {
    const layers = assignLayers([{ id: "a", run: "true" }]);
    expect(layers.get("a")).toBe(0);
  });
  it("a linear chain a→b→c layers 0,1,2", () => {
    const steps: FlowStepDef[] = [
      { id: "c", run: "true", "depends-on": "b" },
      { id: "a", run: "true" },
      { id: "b", run: "true", "depends-on": "a" },
    ];
    const layers = assignLayers(steps);
    expect(layers.get("a")).toBe(0);
    expect(layers.get("b")).toBe(1);
    expect(layers.get("c")).toBe(2);
  });
  it("a fan-in step layers 1 + the MAX of its deps' layers", () => {
    // a (0), b depends on a (1), c depends on a (1), d depends on b AND c (2)
    const steps: FlowStepDef[] = [
      { id: "a", run: "true" },
      { id: "b", run: "true", "depends-on": "a" },
      { id: "c", run: "true", "depends-on": ["a"] },
      { id: "d", run: "true", "depends-on": ["b", "c"] },
    ];
    const layers = assignLayers(steps);
    expect(layers.get("d")).toBe(2);
  });
  it("a dangling dep (id not in the step set) is ignored, not refused", () => {
    const layers = assignLayers([{ id: "a", run: "true", "depends-on": "ghost" }]);
    expect(layers.get("a")).toBe(0);
  });
  it("a cycle degrades to layer 0 rather than looping forever", () => {
    const steps: FlowStepDef[] = [
      { id: "a", run: "true", "depends-on": "b" },
      { id: "b", run: "true", "depends-on": "a" },
    ];
    const layers = assignLayers(steps);
    expect(layers.get("a")).toBe(0);
    expect(layers.get("b")).toBe(0);
  });
  it("a self-dependency is ignored", () => {
    const layers = assignLayers([{ id: "a", run: "true", "depends-on": "a" }]);
    expect(layers.get("a")).toBe(0);
  });
});

describe("layoutFlow — deterministic left→right geometry (no physics)", () => {
  it("places a linear chain at increasing x, same y", () => {
    const steps: FlowStepDef[] = [
      { id: "a", run: "true" },
      { id: "b", run: "true", "depends-on": "a" },
      { id: "c", run: "true", "depends-on": "b" },
    ];
    const { nodes } = layoutFlow(steps);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(byId.get("a")!.x).toBe(0);
    expect(byId.get("b")!.x).toBe(LAYER_DX);
    expect(byId.get("c")!.x).toBe(LAYER_DX * 2);
    expect(byId.get("a")!.y).toBe(byId.get("b")!.y);
  });
  it("stacks same-layer steps top-to-bottom in SOURCE order (never re-sorted)", () => {
    const steps: FlowStepDef[] = [
      { id: "z", run: "true" },
      { id: "a", run: "true" },
    ];
    const { nodes } = layoutFlow(steps);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(byId.get("z")!.y).toBe(0);
    expect(byId.get("a")!.y).toBe(NODE_DY);
    expect(byId.get("z")!.order).toBe(0);
    expect(byId.get("a")!.order).toBe(1);
  });
  it("edges connect right-center of the dep to left-center of the dependent", () => {
    const steps: FlowStepDef[] = [{ id: "a", run: "true" }, { id: "b", run: "true", "depends-on": "a" }];
    const { edges } = layoutFlow(steps);
    expect(edges).toHaveLength(1);
    const e = edges[0]!;
    expect(e.from).toBe("a");
    expect(e.to).toBe("b");
    expect(e.x1).toBe(NODE_W); // a's right edge (a sits at x=0)
    expect(e.y1).toBe(NODE_H / 2);
    expect(e.x2).toBe(LAYER_DX); // b's left edge (b sits at x=LAYER_DX)
  });
  it("a step with compensate: gets a detached compensation node + edge, and reserves row height (no overlap with the next same-layer step)", () => {
    const steps: FlowStepDef[] = [
      { id: "a", run: "true", compensate: "undo a" },
      { id: "b", run: "true" }, // same layer (no deps) — stacks below a
    ];
    const { nodes, compensationNodes, compensationEdges } = layoutFlow(steps);
    expect(compensationNodes).toHaveLength(1);
    expect(compensationNodes[0]!.forStepId).toBe("a");
    expect(compensationEdges).toHaveLength(1);
    expect(compensationEdges[0]!).toMatchObject({ from: "a", to: "a__compensate" });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // b must sit BELOW the compensation node's row, never overlapping it
    expect(byId.get("b")!.y).toBeGreaterThan(compensationNodes[0]!.y + NODE_H);
  });
  it("a step with no compensate: gets no detached node", () => {
    const { compensationNodes } = layoutFlow([{ id: "a", run: "true" }]);
    expect(compensationNodes).toEqual([]);
  });
  it("an empty workflow lays out to a zero-node, non-negative-size document", () => {
    const layout = layoutFlow([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.width).toBeGreaterThanOrEqual(0);
    expect(layout.height).toBeGreaterThanOrEqual(0);
  });
});

describe("edgePath — a horizontal bezier string", () => {
  it("starts at (x1,y1) and ends at (x2,y2)", () => {
    const d = edgePath(0, 10, 100, 40);
    expect(d.startsWith("M0,10")).toBe(true);
    expect(d.endsWith("100,40")).toBe(true);
  });
});

describe("runStepRing — run-state → node ring mapping (the Executions overlay)", () => {
  it("maps each known status", () => {
    expect(runStepRing("running")).toBe("running");
    expect(runStepRing("done")).toBe("done");
    expect(runStepRing("failed")).toBe("failed");
    expect(runStepRing("waiting")).toBe("waiting");
    expect(runStepRing("pending")).toBe("idle");
  });
  it("degrades an unknown/absent status to idle, never throws", () => {
    expect(runStepRing(undefined)).toBe("idle");
    expect(runStepRing(null)).toBe("idle");
    expect(runStepRing("something-new")).toBe("idle");
  });
});

describe("waitBadgeSignal — the wait step's signal badge (definitional vs live)", () => {
  it("a non-wait step never carries the badge", () => {
    expect(waitBadgeSignal("run", false, "idle", "sig", "sig")).toBeNull();
  });
  it("no run selected → the definition's own signal, informational", () => {
    expect(waitBadgeSignal("wait", false, "idle", "sales-approval", null)).toBe("sales-approval");
  });
  it("no run selected, no declared signal → null", () => {
    expect(waitBadgeSignal("wait", false, "idle", null, null)).toBeNull();
  });
  it("a run selected but this step's ring isn't 'waiting' (done/idle/failed) → no badge, even though the definition still declares a signal", () => {
    expect(waitBadgeSignal("wait", true, "done", "sales-approval", null)).toBeNull();
    expect(waitBadgeSignal("wait", true, "idle", "sales-approval", null)).toBeNull();
    expect(waitBadgeSignal("wait", true, "failed", "sales-approval", null)).toBeNull();
  });
  it("a run selected and genuinely waiting → the run's OWN waiting_on", () => {
    expect(waitBadgeSignal("wait", true, "waiting", "sales-approval", "sales-approval")).toBe("sales-approval");
  });
  it("a run selected, waiting, but the run carries no waiting_on → falls back to the definition", () => {
    expect(waitBadgeSignal("wait", true, "waiting", "sales-approval", null)).toBe("sales-approval");
  });
});

describe("overlayRunState — joins node ids against a (possibly absent) run", () => {
  it("no run selected → every node maps to null", () => {
    const overlay = overlayRunState(["a", "b"], undefined);
    expect(overlay.get("a")).toBeNull();
    expect(overlay.get("b")).toBeNull();
  });
  it("a run's steps join by id", () => {
    const overlay = overlayRunState(["a", "b"], [{ id: "a", status: "done" }]);
    expect(overlay.get("a")).toEqual({ id: "a", status: "done" });
    expect(overlay.get("b")).toBeNull(); // the run doesn't carry this step (edited-after-start) — idle, not a crash
  });
});

describe("runProgress — the run list's compact readout", () => {
  it("counts done vs total, flags failed/waiting", () => {
    expect(runProgress([{ id: "a", status: "done" }, { id: "b", status: "pending" }])).toEqual({ done: 1, total: 2, failed: false, waiting: false });
    expect(runProgress([{ id: "a", status: "failed" }]).failed).toBe(true);
    expect(runProgress([{ id: "a", status: "waiting" }]).waiting).toBe(true);
  });
});

describe("compensationFired — the saga join", () => {
  it("finds a step's compensation entry by id", () => {
    expect(compensationFired("setup", [{ id: "setup", success: true }])).toEqual({ id: "setup", success: true });
  });
  it("null when the step never compensated (no failure, or absent)", () => {
    expect(compensationFired("setup", [])).toBeNull();
    expect(compensationFired("setup", undefined)).toBeNull();
  });
});

describe("flowGrid — the Airflow-style runs×steps state matrix", () => {
  it("one row per run, one cell per workflow step, in layout order", () => {
    const rows = flowGrid(["a", "b"], [
      { id: "run-1", status: "done", steps: [{ id: "a", status: "done" }, { id: "b", status: "done" }] },
      { id: "run-2", status: "failed", steps: [{ id: "a", status: "done" }, { id: "b", status: "failed" }] },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.cells).toEqual([{ stepId: "a", ring: "done" }, { stepId: "b", ring: "done" }]);
    expect(rows[1]!.cells).toEqual([{ stepId: "a", ring: "done" }, { stepId: "b", ring: "failed" }]);
  });
  it("a step the run doesn't carry renders idle, columns still line up", () => {
    const rows = flowGrid(["a", "b"], [{ id: "run-1", status: "running", steps: [{ id: "a", status: "running" }] }]);
    expect(rows[0]!.cells).toEqual([{ stepId: "a", ring: "running" }, { stepId: "b", ring: "idle" }]);
  });
});

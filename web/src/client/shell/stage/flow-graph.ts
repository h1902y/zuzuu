// shell/stage/flow-graph.ts — the FLOW PROJECTION's pure model (§I rung 5, the
// third view of a Project: [Table · Map · Flow]). Everything here is derivable
// data, no DOM: topological LAYER assignment + a deterministic left→right layout
// (never force physics — a workflow's step order is meaning, not a random walk),
// and the run-state → node-style join that overlays a selected run's live status
// onto the DAG. Mirrors world/model.ts's discipline (pure, tested; world.ts/
// Flow.tsx render it) — and mirrors the CLI's OWN step-shape/topo-sort doctrine
// (src/use/workflow.mjs, src/grow/run.mjs) so a step that's valid on disk lays
// out identically to how the runner actually walks it.
//
// STEP VOCABULARY (§I.4 #6, "small closed step vocabulary"): a step is exactly
// one of run | note | wait — never more/fewer. A step whose shape doesn't parse
// (both/neither) still renders (READ-ONLY view of whatever is on disk — the
// write-time validator is the real guard, not this) as kind 'invalid', at layer 0.

export interface FlowWaitDef { on?: string; timeout?: string }

/** One step of a `type: workflow` note's `steps:` array, as it rides the wire
 *  (an envelope's frontmatter is tolerant — extra keys ride through untyped). */
export interface FlowStepDef {
  id: string;
  run?: string;
  note?: string;
  wait?: FlowWaitDef;
  "depends-on"?: string | string[];
  compensate?: string;
  timeout?: number;
  irreversible?: boolean;
  retry?: { max?: number };
  [k: string]: unknown;
}

export type StepKind = "run" | "note" | "wait" | "invalid";

/** A step is EITHER run: OR note: OR wait:{on,…} — never more than one (mirrors
 *  src/grow/run.mjs's `stepKind`). 'invalid' when zero or more-than-one is set —
 *  rendered, never hidden (a malformed step on disk must still be visible). */
export function stepKind(s: FlowStepDef): StepKind {
  const hasRun = typeof s.run === "string" && s.run.trim() !== "";
  const hasNote = typeof s.note === "string" && s.note.trim() !== "";
  const hasWait = !!s.wait && typeof s.wait === "object" && typeof s.wait.on === "string" && s.wait.on.trim() !== "";
  const n = Number(hasRun) + Number(hasNote) + Number(hasWait);
  if (n !== 1) return "invalid";
  return hasWait ? "wait" : hasNote ? "note" : "run";
}

/** `depends-on` rides as a bare string OR a block list — normalize to an array. */
export function dependsOn(s: FlowStepDef): string[] {
  const d = s["depends-on"];
  if (!d) return [];
  return (Array.isArray(d) ? d : [d]).filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

// ── topo-layer assignment (longest-path-from-roots) ─────────────────────────

/** Each step's LAYER: 0 for a root (no deps, or all deps missing from the set),
 *  else 1 + the max layer of its dependencies — the standard longest-path
 *  layering a left→right DAG view wants (a step never renders LEFT of anything
 *  it depends on). Dangling deps (an id not among `steps`) are ignored, not
 *  refused — this is a READ-ONLY view of whatever is on disk; `zz run start`'s
 *  own topoSort is the real cycle/dangling-dep guard here. Kahn-style waves (not
 *  DFS): repeatedly layer every step whose deps are ALL already resolved, until
 *  a pass makes no progress; anything still unresolved is a cycle (or depends
 *  only on cycle members) — those render at layer 0 as a BATCH (a cyclic step
 *  reads as a root, never hangs the tab, never lets outer callers inflate a
 *  cycle's layer one hop at a time). */
export function assignLayers(steps: readonly FlowStepDef[]): Map<string, number> {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const deps = new Map(steps.map((s) => [s.id, dependsOn(s).filter((d) => byId.has(d) && d !== s.id)]));
  const layer = new Map<string, number>();
  const resolved = new Set<string>();

  let progressed = true;
  while (progressed && resolved.size < steps.length) {
    progressed = false;
    for (const s of steps) {
      if (resolved.has(s.id)) continue;
      const ds = deps.get(s.id)!;
      if (!ds.every((d) => resolved.has(d))) continue;
      layer.set(s.id, ds.length ? 1 + Math.max(...ds.map((d) => layer.get(d)!)) : 0);
      resolved.add(s.id);
      progressed = true;
    }
  }
  for (const s of steps) if (!resolved.has(s.id)) layer.set(s.id, 0); // cycle remainder → layer 0

  return layer;
}

// ── deterministic left→right layout (pixel geometry, no physics) ────────────

export const NODE_W = 168;
export const NODE_H = 56;
export const LAYER_DX = 232; // NODE_W + a gap wide enough for the edge's curve
export const NODE_DY = 84; // NODE_H + a row gap
export const COMP_ROW_DY = 60; // extra vertical room a detached compensation node reserves
export const COMP_W = 132; // a compensation node is deliberately SMALLER — a quiet annotation, not a peer step
export const COMP_H = 30;
export const CANVAS_MARGIN = 32; // breathing room so edges/nodes never touch the SVG's own edge

export interface FlowNodeLayout {
  id: string;
  kind: StepKind;
  layer: number;
  order: number; // index within its layer, in SOURCE step order (deterministic)
  x: number;
  y: number;
  def: FlowStepDef;
}

/** A DETACHED compensation node (§I.4 "Retool: detached error/compensation
 *  nodes"): a step's `compensate:` command, rendered as its own small node below
 *  the step's row rather than folded into it — failure routes stay untangled
 *  from the happy path, exactly the pattern named. */
export interface FlowCompNodeLayout {
  id: string; // `${forStepId}__compensate` — stable, never collides with a real step id (steps can't contain "__")
  forStepId: string;
  x: number;
  y: number;
}

export interface FlowEdgeLayout {
  from: string;
  to: string;
  /** the source/target CONNECTION points (right-center of `from` → left-center
   *  of `to`) — precomputed here so the renderer never re-derives node geometry. */
  x1: number; y1: number; x2: number; y2: number;
}

export interface FlowCompEdgeLayout { from: string; to: string; x1: number; y1: number; x2: number; y2: number }

export interface FlowLayout {
  nodes: FlowNodeLayout[];
  edges: FlowEdgeLayout[];
  compensationNodes: FlowCompNodeLayout[];
  compensationEdges: FlowCompEdgeLayout[];
  width: number;
  height: number;
}

const rightCenter = (x: number, y: number) => ({ x: x + NODE_W, y: y + NODE_H / 2 });
const leftCenter = (x: number, y: number) => ({ x, y: y + NODE_H / 2 });

/** Lay out a workflow's steps left→right by layer; within a layer, steps stack
 *  top→bottom in their ORIGINAL source order (stable — never re-sorted by id or
 *  status, so the same workflow always draws the same way). A step with
 *  `compensate:` reserves extra row height for its detached compensation node
 *  (placed just below it, connected by its own dashed edge) — layers never
 *  overlap regardless of which rows carry compensations. */
export function layoutFlow(steps: readonly FlowStepDef[]): FlowLayout {
  const layers = assignLayers(steps);
  const byLayer = new Map<number, FlowStepDef[]>();
  for (const s of steps) {
    const l = layers.get(s.id) ?? 0;
    const group = byLayer.get(l);
    if (group) group.push(s); else byLayer.set(l, [s]);
  }

  const nodes: FlowNodeLayout[] = [];
  const compensationNodes: FlowCompNodeLayout[] = [];
  const compensationEdges: FlowCompEdgeLayout[] = [];
  const posById = new Map<string, { x: number; y: number }>();
  let maxLayer = 0;
  let maxY = 0;

  for (const [l, group] of byLayer) {
    maxLayer = Math.max(maxLayer, l);
    let y = 0;
    group.forEach((s, i) => {
      const x = l * LAYER_DX;
      posById.set(s.id, { x, y });
      nodes.push({ id: s.id, kind: stepKind(s), layer: l, order: i, x, y, def: s });
      y += NODE_DY;
      if (typeof s.compensate === "string" && s.compensate.trim() !== "") {
        const compId = `${s.id}__compensate`;
        const compY = y - NODE_DY / 2;
        compensationNodes.push({ id: compId, forStepId: s.id, x, y: compY });
        const from = leftCenter(x, posById.get(s.id)!.y); // the step's own left edge — the compensation hangs below/behind it
        compensationEdges.push({ from: s.id, to: compId, x1: from.x + NODE_W / 2, y1: from.y + NODE_H / 2, x2: x + NODE_W / 2, y2: compY });
        y += COMP_ROW_DY;
      }
    });
    maxY = Math.max(maxY, y);
  }

  const edges: FlowEdgeLayout[] = [];
  const ids = new Set(steps.map((s) => s.id));
  for (const s of steps) {
    for (const d of dependsOn(s)) {
      if (!ids.has(d) || d === s.id) continue;
      const from = posById.get(d);
      const to = posById.get(s.id);
      if (!from || !to) continue;
      const a = rightCenter(from.x, from.y);
      const b = leftCenter(to.x, to.y);
      edges.push({ from: d, to: s.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }

  return {
    nodes, edges, compensationNodes, compensationEdges,
    width: (maxLayer + 1) * LAYER_DX,
    height: Math.max(NODE_DY, maxY),
  };
}

/** A gentle horizontal cubic-bezier path between two connection points — the
 *  standard flow-diagram curve (control points pulled toward the midpoint on
 *  the X axis, so edges read left→right even when Y jumps between rows). */
export function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

// ── run-state → node-style mapping (the Executions overlay) ─────────────────

export type RunStepStatusName = "pending" | "running" | "done" | "failed" | "waiting";
export type NodeRing = "idle" | "running" | "done" | "failed" | "waiting";

export interface FlowRunStepState {
  id: string;
  status: string;
  attempts?: number;
  started?: string | null;
  ended?: string | null;
  waiting_on?: string | null;
  exit_code?: number | null;
  error?: string | null;
}

/** A run step's status → the node's ring (idle when no run is selected, or the
 *  run carries no entry for this step id — a workflow edited after the run
 *  started, or simply no run in focus). Never throws on an unknown status
 *  string — an unrecognized value degrades to 'idle' rather than miscoloring. */
export function runStepRing(status: string | undefined | null): NodeRing {
  switch (status) {
    case "running": return "running";
    case "done": return "done";
    case "failed": return "failed";
    case "waiting": return "waiting";
    default: return "idle";
  }
}

/** A `wait` step's signal badge (§I.4 "waits are first-class nodes"). With NO
 *  run selected it's INFORMATIONAL — the definition's own `wait.on`, so the
 *  DAG always names what a wait step is for. With a run selected it must
 *  reflect that RUN's actual state: a step the run already resolved (done) or
 *  hasn't reached (idle) is not "waiting" anymore, however the static
 *  definition reads — the badge lights only when this run's own ring for the
 *  step is genuinely 'waiting' (a definition edited after a run started could
 *  otherwise show a signal the run was never blocked on). */
export function waitBadgeSignal(
  kind: StepKind,
  hasSelectedRun: boolean,
  ring: NodeRing,
  defOn: string | undefined | null,
  runWaitingOn: string | undefined | null,
): string | null {
  if (kind !== "wait") return null;
  if (!hasSelectedRun) return defOn ?? null;
  if (ring !== "waiting") return null;
  return runWaitingOn ?? defOn ?? null;
}

/** Join a workflow's node ids against a (possibly absent) selected run's steps —
 *  `null` overlay everywhere when no run is selected (idle DAG, the Editor/
 *  Definition view); otherwise each node id maps to its run-step state, or
 *  `null` when the run doesn't carry that step (still 'idle', never a crash). */
export function overlayRunState(
  nodeIds: readonly string[],
  runSteps: readonly FlowRunStepState[] | null | undefined,
): Map<string, FlowRunStepState | null> {
  const byId = new Map((runSteps ?? []).map((s) => [s.id, s]));
  const out = new Map<string, FlowRunStepState | null>();
  for (const id of nodeIds) out.set(id, byId.get(id) ?? null);
  return out;
}

// ── run progress + the saga (compensation-fired) join ───────────────────────

export interface RunProgress { done: number; total: number; failed: boolean; waiting: boolean }

/** "3/5 done" + whether the run has failed/is waiting — the run list's compact
 *  progress readout (also feeds the Grid strip's row summary). */
export function runProgress(steps: readonly FlowRunStepState[]): RunProgress {
  return {
    done: steps.filter((s) => s.status === "done").length,
    total: steps.length,
    failed: steps.some((s) => s.status === "failed"),
    waiting: steps.some((s) => s.status === "waiting"),
  };
}

export interface FlowCompensationEntry {
  id: string;
  success?: boolean;
  irreversible?: boolean;
  compensated?: boolean;
  [k: string]: unknown;
}

/** Did THIS step's `compensate:` fire in the given run's saga log
 *  (`compensations[]`, written in reverse-completion order on failure)? `null`
 *  when it never ran (no failure, or this step completed after/never reached
 *  the point compensation walked back to — see `irreversible` stopping early). */
export function compensationFired(
  stepId: string,
  compensations: readonly FlowCompensationEntry[] | null | undefined,
): FlowCompensationEntry | null {
  return (compensations ?? []).find((c) => c.id === stepId) ?? null;
}

// ── the Grid strip (§I.4 Airflow: runs × steps state matrix) ────────────────

export interface GridCell { stepId: string; ring: NodeRing }
export interface GridRow { runId: string; status: string; cells: GridCell[] }

/** The runs×steps state matrix: one row per run, one cell per WORKFLOW step (in
 *  its layout order, so columns line up with the DAG above) — a step the run
 *  hasn't reached yet (or doesn't carry) renders 'idle'. Pure join; the caller
 *  sorts/caps the run list. */
export function flowGrid(stepIds: readonly string[], runs: readonly { id: string; status: string; steps: readonly FlowRunStepState[] }[]): GridRow[] {
  return runs.map((r) => {
    const overlay = overlayRunState(stepIds, r.steps);
    return {
      runId: r.id,
      status: r.status,
      cells: stepIds.map((id) => ({ stepId: id, ring: runStepRing(overlay.get(id)?.status) })),
    };
  });
}

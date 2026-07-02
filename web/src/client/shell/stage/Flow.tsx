// shell/stage/Flow.tsx — the FLOW PROJECTION (§I rung 5): the third view of a
// Project — [Table · Map · Flow]. A SELECTED workflow's steps render as a
// topological left→right DAG (the "Editor"/DEFINITION view, §I.4's n8n split);
// its runs list in the Executions sidebar, each row doubling as one line of the
// Airflow-style runs×steps state matrix (a compact per-run step-strip, given the
// sidebar's width — the state-colored-matrix INTENT, not a literal wide table);
// selecting a run overlays its LIVE step state onto the SAME DAG (idle · running ·
// done · failed · waiting rings), badges a waiting step with its signal, and lights
// any compensation edges the run's saga actually fired. Detached compensation
// nodes (Retool pattern) and irreversible markers render regardless of run focus.
//
// READ-ONLY (scope discipline): no run-control buttons, no canvas editing — the
// DAG comes from the note's `steps` (the gate/omnibar own writes); advancing a
// run is `zz run advance` / a later pass. Live updates ride the SAME brain push
// every other zuzuu-prefixed query already gets (WorkbenchShell's brainEvents
// invalidates the whole ["zuzuu"] queryKey family on any module change) — no
// bespoke WS wiring needed here, same as the World's ghost nodes.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Workflow, Play, Link2, Hourglass, AlertTriangle, Undo2, Lock } from "lucide-react";
import { api } from "../../lib/api.js";
import { useWorld } from "../world-state.js";
import { relativeTimeFromIso } from "../../lib/time.js";
import type { ModuleItem, FlowWorkflowSummary } from "#shared/index.js";
import {
  layoutFlow, edgePath, runStepRing, overlayRunState, runProgress, compensationFired, flowGrid, waitBadgeSignal,
  NODE_W, NODE_H, COMP_W, COMP_H, CANVAS_MARGIN,
  type FlowStepDef, type FlowRunStepState, type FlowCompensationEntry, type NodeRing, type StepKind,
} from "./flow-graph.js";
import { EmptyState, Loading, Icon, Text, Inline, Stack } from "../../ds/index.js";
import { emptyCopy } from "../empty-copy.js";
import "./flow.css";

interface WorkflowNote extends ModuleItem { steps?: FlowStepDef[] }
interface RunNote extends ModuleItem {
  workflow: string;
  workflow_generation?: number;
  steps: FlowRunStepState[];
  completed_order?: string[];
  compensations?: FlowCompensationEntry[];
  waiting_on?: string | null;
  failed_step?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

const KIND_ICON: Record<StepKind, typeof Play> = { run: Play, note: Link2, wait: Hourglass, invalid: AlertTriangle };
const KIND_LABEL: Record<StepKind, string> = { run: "run", note: "note", wait: "wait", invalid: "invalid" };
const RING_CLASS: Record<NodeRing, string> = {
  idle: "zz-flow-node-ring-idle",
  running: "zz-flow-node-ring-running",
  done: "zz-flow-node-ring-done",
  failed: "zz-flow-node-ring-failed",
  waiting: "zz-flow-node-ring-waiting",
};
const DOT_CLASS: Record<NodeRing, string> = {
  idle: "zz-flow-run-dot",
  running: "zz-flow-run-dot zz-flow-run-dot-running",
  done: "zz-flow-run-dot zz-flow-run-dot-done",
  failed: "zz-flow-run-dot zz-flow-run-dot-failed",
  waiting: "zz-flow-run-dot zz-flow-run-dot-waiting",
};
const STATUS_PILL_CLASS: Record<string, string> = {
  running: "zz-flow-status-pill zz-flow-status-running",
  waiting: "zz-flow-status-pill zz-flow-status-waiting",
  done: "zz-flow-status-pill zz-flow-status-done",
  failed: "zz-flow-status-pill zz-flow-status-failed",
};

/** The Flow stage: `module`+`id` focus one workflow's DAG; both absent shows the
 *  Flow HOME (a workflow picker) — reached via the header toggle, `>flow`, or
 *  selecting a workflow note anywhere (map/table). */
export function Flow({ module, id }: { module?: string; id?: string }) {
  const select = useWorld((s) => s.select);
  const flowList = useQuery({ queryKey: ["zuzuu", "flow"], queryFn: api.zuzuu.flow });

  if (!module || !id) {
    return (
      <FlowHome
        loading={flowList.isLoading}
        degraded={!!flowList.data?.degraded}
        workflows={flowList.data?.workflows ?? []}
        onPick={(m, i) => select({ kind: "flow", module: m, id: i })}
      />
    );
  }
  return <FlowWorkflow module={module} id={id} />;
}

function FlowHome({ loading, degraded, workflows, onPick }: {
  loading: boolean; degraded: boolean; workflows: FlowWorkflowSummary[]; onPick: (module: string, id: string) => void;
}) {
  if (loading) return <Loading label="loading workflows…" />;
  if (!workflows.length) return <EmptyState icon={Workflow} {...emptyCopy(degraded ? "flow-degraded" : "flow-empty")} />;
  return (
    <div className="h-full overflow-y-auto p-6">
      <Text size="meta" tone="muted">Flow — pick a workflow to open its DAG</Text>
      <div className="mt-3 flex flex-col gap-2">
        {workflows.map((w) => (
          <button
            key={w.addr}
            type="button"
            onClick={() => onPick(w.module, w.id)}
            className="flex items-center justify-between gap-3 rounded-ui border border-border bg-elevated px-4 py-3 text-left transition-colors hover:border-accent-dim"
          >
            <Inline gap="sm" align="center">
              <Icon icon={Workflow} size={15} />
              <Stack gap="none">
                <Text size="ui" weight="medium">{w.title}</Text>
                <Text size="meta" tone="muted" mono>{w.addr} · {w.stepCount} step{w.stepCount === 1 ? "" : "s"}</Text>
              </Stack>
            </Inline>
            <Inline gap="xs" align="center">
              {w.latestRun && <span className={STATUS_PILL_CLASS[w.latestRun.status] ?? "zz-flow-status-pill"}>{w.latestRun.status}</span>}
              <Text size="meta" tone="muted">{w.runs.total} run{w.runs.total === 1 ? "" : "s"}</Text>
            </Inline>
          </button>
        ))}
      </div>
    </div>
  );
}

function FlowWorkflow({ module, id }: { module: string; id: string }) {
  const wfQuery = useQuery({ queryKey: ["zuzuu", "flow-item", module, id], queryFn: () => api.zuzuu.item(module, id) });
  const runsQuery = useQuery({
    queryKey: ["zuzuu", "flow-runs", module, id],
    queryFn: () => api.zuzuu.module("runs", { where: [`workflow=${module}:${id}`] }),
  });

  const wf = wfQuery.data as WorkflowNote | undefined;
  const steps = useMemo<FlowStepDef[]>(() => (Array.isArray(wf?.steps) ? wf.steps : []), [wf]);
  const layout = useMemo(() => layoutFlow(steps), [steps]);
  const nodeIds = useMemo(() => layout.nodes.map((n) => n.id), [layout]);
  const runs = useMemo<RunNote[]>(
    () => ((runsQuery.data?.items ?? []) as unknown as RunNote[])
      .slice()
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))),
    [runsQuery.data],
  );

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  useEffect(() => { setSelectedRunId(null); }, [module, id]); // a new workflow focus resets the run overlay
  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;
  const overlay = overlayRunState(nodeIds, selectedRun?.steps);
  const grid = useMemo(() => flowGrid(nodeIds, runs.map((r) => ({ id: r.id, status: r.status ?? "", steps: r.steps ?? [] }))), [nodeIds, runs]);
  const gridByRun = useMemo(() => new Map(grid.map((g) => [g.runId, g])), [grid]);

  if (wfQuery.isLoading) return <Loading />;
  if (!wf || !steps.length) return <EmptyState icon={Workflow} {...emptyCopy("flow-empty")} />;

  const svgW = layout.width + CANVAS_MARGIN * 2;
  const svgH = layout.height + CANVAS_MARGIN * 2;

  return (
    <div className="zz-flow flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <Stack gap="none">
          <Inline gap="sm" align="center">
            <Icon icon={Workflow} size={16} />
            <Text size="ui" weight="medium">{wf.title || id}</Text>
          </Inline>
          <Text size="meta" tone="muted" mono>{module}:{id} · {steps.length} step{steps.length === 1 ? "" : "s"}</Text>
        </Stack>
        {selectedRun && <RunStatusLine run={selectedRun} onClear={() => setSelectedRunId(null)} />}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="zz-flow-canvas-wrap min-h-0 flex-1 overflow-auto">
          <svg className="zz-flow-svg" width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
            <g transform={`translate(${CANVAS_MARGIN},${CANVAS_MARGIN})`}>
              {layout.compensationEdges.map((e) => {
                const fired = compensationFired(e.from, selectedRun?.compensations);
                return (
                  <path
                    key={`comp-edge-${e.from}`}
                    className={`zz-flow-edge-comp${fired ? " zz-flow-edge-fired" : ""}`}
                    d={edgePath(e.x1, e.y1, e.x2, e.y2)}
                  />
                );
              })}
              {layout.edges.map((e) => (
                <path key={`edge-${e.from}-${e.to}`} className="zz-flow-edge" d={edgePath(e.x1, e.y1, e.x2, e.y2)} />
              ))}
              {layout.nodes.map((n) => {
                const runStep = overlay.get(n.id) ?? null;
                const ring = selectedRun ? runStepRing(runStep?.status) : "idle";
                const KindIcon = KIND_ICON[n.kind];
                const waitingSignal = waitBadgeSignal(n.kind, !!selectedRun, ring, n.def.wait?.on, runStep?.waiting_on);
                return (
                  <foreignObject key={n.id} x={n.x} y={n.y} width={NODE_W} height={NODE_H}>
                    <div className="zz-flow-node-wrap">
                      <div className={`zz-flow-node ${RING_CLASS[ring]}${n.kind === "invalid" ? " zz-flow-node-invalid" : ""}`} title={`${n.id} · ${KIND_LABEL[n.kind]}`}>
                        <span className="zz-flow-node-icon"><Icon icon={KindIcon} size={13} /></span>
                        <span className="zz-flow-node-body">
                          <span className="zz-flow-node-id">{n.id}</span>
                          <span className="zz-flow-node-sub">
                            {n.kind === "note" ? n.def.note : n.kind === "wait" ? "wait" : n.kind === "invalid" ? "invalid step" : "run"}
                          </span>
                          {waitingSignal && <span className="zz-flow-wait-badge">waiting: {waitingSignal}</span>}
                        </span>
                      </div>
                      {n.def.irreversible && (
                        <span className="zz-flow-node-irreversible" title="irreversible — the saga stops here, never a fake rollback">
                          <Icon icon={Lock} size={9} />
                        </span>
                      )}
                    </div>
                  </foreignObject>
                );
              })}
              {layout.compensationNodes.map((c) => {
                const fired = compensationFired(c.forStepId, selectedRun?.compensations);
                const ok = fired?.success !== false;
                return (
                  <foreignObject key={c.id} x={c.x} y={c.y} width={COMP_W} height={COMP_H}>
                    <div className={`zz-flow-comp-node${fired ? ` zz-flow-comp-node-fired ${ok ? "zz-flow-comp-node-ok" : "zz-flow-comp-node-bad"}` : ""}`} title="compensate — fires in reverse on failure (the saga)">
                      <Icon icon={Undo2} size={11} />
                      <span className="zz-flow-comp-node-label">{fired ? (ok ? "compensated" : "compensate failed") : "compensate"}</span>
                    </div>
                  </foreignObject>
                );
              })}
            </g>
          </svg>
        </div>
        <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface lg:flex">
          <div className="shrink-0 border-b border-border px-4 py-2.5">
            <Text size="meta" tone="muted">Executions — {runs.length} run{runs.length === 1 ? "" : "s"}</Text>
          </div>
          {!runs.length ? (
            <div className="px-4 py-6"><Text size="meta" tone="muted">No runs yet — `zz run start {module}:{id}`.</Text></div>
          ) : (
            runs.map((r) => (
              <RunRow
                key={r.id}
                run={r}
                active={r.id === selectedRunId}
                dots={gridByRun.get(r.id)?.cells ?? []}
                onClick={() => setSelectedRunId((cur) => (cur === r.id ? null : r.id))}
              />
            ))
          )}
        </aside>
      </div>
    </div>
  );
}

function RunRow({ run, active, dots, onClick }: {
  run: RunNote; active: boolean; dots: { stepId: string; ring: NodeRing }[]; onClick: () => void;
}) {
  const progress = runProgress(run.steps ?? []);
  return (
    <button type="button" onClick={onClick} className={`zz-flow-run-row${active ? " zz-flow-run-row-active" : ""}`}>
      <Inline gap="sm" justify="between">
        <Text size="meta" mono tone="default" truncate>{run.id}</Text>
        <span className={STATUS_PILL_CLASS[run.status ?? ""] ?? "zz-flow-status-pill"}>{run.status}</span>
      </Inline>
      <Inline gap="sm" justify="between">
        <Text size="meta" tone="muted">{relativeTimeFromIso(run.started_at, Date.now())}</Text>
        <Text size="meta" tone="muted">{progress.done}/{progress.total} done</Text>
      </Inline>
      <div className="zz-flow-run-strip">
        {dots.map((d) => <span key={d.stepId} className={DOT_CLASS[d.ring]} title={`${d.stepId}: ${d.ring}`} />)}
      </div>
    </button>
  );
}

function RunStatusLine({ run, onClear }: { run: RunNote; onClear: () => void }) {
  const progress = runProgress(run.steps ?? []);
  return (
    <Inline gap="sm" align="center">
      <span className={STATUS_PILL_CLASS[run.status ?? ""] ?? "zz-flow-status-pill"}>{run.status}</span>
      <Text size="meta" tone="muted">{run.id} · {progress.done}/{progress.total} done</Text>
      {run.status === "waiting" && run.waiting_on && <Text size="meta" tone="muted">waiting on {run.waiting_on}</Text>}
      {run.status === "failed" && run.failed_step && <Text size="meta" tone="danger">failed at {run.failed_step}</Text>}
      <Text as="button" interactive size="meta" tone="subtle" onClick={onClear}>clear</Text>
    </Inline>
  );
}

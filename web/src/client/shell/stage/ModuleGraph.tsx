// shell/stage/ModuleGraph.tsx — the module's notes as a node-link graph (P2.7, the
// Graph tab). Nodes = notes on a circular layout; edges = [[wikilink]] references
// (module-graph.ts, tested). Clicking a node selects the row. Dependency-free SVG;
// colors via token fill-/stroke- utilities (no inline styles / arbitrary values).
import { useQuery } from "@tanstack/react-query";
import { Table2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { moduleGraph, circularLayout } from "./module-graph.js";
import { emptyCopy } from "../empty-copy.js";
import { useWorld } from "../world-state.js";
import { Text, EmptyState } from "../../ds/index.js";

const VIEW = 1000;
const R = 380;
const C = VIEW / 2;

export function ModuleGraph({ module }: { module: string }) {
  const detail = useQuery({ queryKey: ["zuzuu", "module", module], queryFn: () => api.zuzuu.module(module) });
  const select = useWorld((s) => s.select);

  if (detail.isLoading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  const items = detail.data?.items ?? [];
  if (!items.length) return <EmptyState icon={Table2} {...emptyCopy("grid-empty")} />;

  const { nodes, edges } = moduleGraph(items);
  const layout = circularLayout(nodes.length);
  const pos = new Map(nodes.map((n, i) => [n.id, { x: C + layout[i]!.x * R, y: C + layout[i]!.y * R }]));

  return (
    <div className="h-full overflow-hidden p-6">
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="h-full w-full" role="img" aria-label={`${module} graph`}>
        <g className="stroke-border">
          {edges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            return <line key={`${e.from}-${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={1.5} />;
          })}
        </g>
        {nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          return (
            <g key={n.id} className="cursor-pointer" onClick={() => select({ kind: "row", id: n.id, module })}>
              <circle cx={p.x} cy={p.y} r={11} strokeWidth={2} className="fill-accent stroke-surface" />
              <text x={p.x} y={p.y - 18} textAnchor="middle" className="fill-subtle text-meta">{n.title}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

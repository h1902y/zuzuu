// shell/graph/BrainGraph.tsx — the whole-brain graph surface (P3.1). Aggregates every
// module's notes (overview → per-module detail) into one node-link graph (brain-graph.ts,
// tested), laid out on a circle, colored by module via the --color-mod-* tokens.
// Clicking a node opens that record. Dependency-free SVG; token fill-/stroke- utilities
// only (no inline styles / arbitrary values).
import { useQuery } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { brainGraph, splitNodeId } from "./brain-graph.js";
import { circularLayout } from "../stage/module-graph.js";
import { useWorld } from "../world-state.js";
import { Inline, Text, Loading, EmptyState } from "../../ds/index.js";

const VIEW = 1000;
const R = 400;
const C = VIEW / 2;

// the standard module hues (custom modules fall back to accent). Literal classes so
// Tailwind's scanner generates them.
const MOD_FILL: Record<string, string> = {
  knowledge: "fill-mod-knowledge",
  memory: "fill-mod-memory",
  actions: "fill-mod-actions",
  instructions: "fill-mod-instructions",
  guardrails: "fill-mod-guardrails",
};
const fillFor = (m: string) => MOD_FILL[m] ?? "fill-accent";

export function BrainGraph() {
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const ids = (overview.data?.modules ?? []).map((m) => m.id);
  const details = useQuery({
    queryKey: ["zuzuu", "brain-graph", ids],
    enabled: ids.length > 0,
    queryFn: async () => Promise.all(ids.map((id) => api.zuzuu.module(id))),
  });
  const select = useWorld((s) => s.select);

  if (overview.isLoading || details.isLoading) return <Loading label="mapping the brain…" />;
  const modules = (details.data ?? []).map((d) => ({ module: d.key, items: d.items }));
  const { nodes, edges } = brainGraph(modules);
  if (!nodes.length) {
    return <EmptyState icon={Share2} title="The brain is empty" hint="As the loop proposes notes and you approve them, they appear here — linked by their [[references]]." />;
  }

  const layout = circularLayout(nodes.length);
  const pos = new Map(nodes.map((n, i) => [n.id, { x: C + layout[i]!.x * R, y: C + layout[i]!.y * R }]));
  const presentModules = [...new Set(nodes.map((n) => n.module))];

  return (
    <div className="flex h-full flex-col p-6">
      <Inline gap="md" wrap>
        {presentModules.map((m) => (
          <Inline key={m} gap="xs" align="center">
            <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden><circle cx={5} cy={5} r={5} className={fillFor(m)} /></svg>
            <Text size="meta" tone="muted">{m}</Text>
          </Inline>
        ))}
      </Inline>
      <div className="min-h-0 flex-1">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="h-full w-full" role="img" aria-label="brain graph">
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
            const { module, id } = splitNodeId(n.id);
            return (
              <g key={n.id} className="cursor-pointer" onClick={() => select({ kind: "row", id, module })}>
                <circle cx={p.x} cy={p.y} r={10} strokeWidth={2} className={`${fillFor(n.module)} stroke-surface`} />
                <text x={p.x} y={p.y - 16} textAnchor="middle" className="fill-subtle text-meta">{n.title}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

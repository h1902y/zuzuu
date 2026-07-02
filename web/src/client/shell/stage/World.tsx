// shell/stage/World.tsx — the thin React mount over the world engine (P3 of the
// personal-app roadmap): the whole project as a two-level force map, replacing the
// fixed-circle ModuleGraph stub. React owns the lifecycle + data; d3 owns the DOM
// inside the container. Ghost nodes render the moat: a pending create proposal
// pulses near its module until approved — clicking it opens the review gate.
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { useWorld } from "../world-state.js";
import { useReview } from "../../state/review.js";
import { useReviewQueue } from "../review/use-review-queue.js";
import { mountWorld, type WorldHandle } from "../../world/world.js";
import { reconcileGhosts } from "../../world/model.js";
import { emptyCopy } from "../empty-copy.js";
import { EmptyState, Text } from "../../ds/index.js";
import "../../world/world.css";

export function World({ focus }: { focus?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<WorldHandle | null>(null);
  const select = useWorld((s) => s.select);
  const setReview = useReview((s) => s.setOpen);
  // lives under ["zuzuu"] so the brain push (/ws/zuzuu) invalidates it live
  const graph = useQuery({ queryKey: ["zuzuu", "graph"], queryFn: () => api.zuzuu.graph() });
  const { queue } = useReviewQueue(); // the aggregated cross-module staged summaries (cached, shared with the gate)

  useEffect(() => {
    if (!ref.current) return;
    const world = mountWorld(ref.current, {
      onSelectNote: (_addr, module, id) => select({ kind: "row", id, module }),
      onSelectModule: (module) => select({ kind: "module", id: module }),
      onGhostClick: () => setReview(true), // the in-map review: the gate overlay, in place
    });
    handle.current = world;
    return () => { handle.current = null; world.destroy(); };
  }, [select, setReview]);

  useEffect(() => {
    if (graph.data) handle.current?.setData(graph.data);
  }, [graph.data]);

  useEffect(() => {
    if (!graph.data) return;
    const present = new Set(graph.data.nodes.map((n) => n.addr));
    handle.current?.setGhosts(reconcileGhosts(queue, present));
  }, [queue, graph.data]);

  useEffect(() => {
    if (focus && graph.data) handle.current?.focusModule(focus);
  }, [focus, graph.data]);

  if (graph.isLoading) return <div className="grid h-full place-items-center"><Text tone="muted">loading the map…</Text></div>;
  if (graph.data && !graph.data.nodes.length) return <EmptyState icon={Table2} {...emptyCopy("grid-empty")} />;
  return <div ref={ref} className="h-full" role="img" aria-label="project map" />;
}

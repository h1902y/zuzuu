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
import { useWorldCommand } from "../../state/world-command.js";
import { useReview } from "../../state/review.js";
import { useReviewQueue } from "../review/use-review-queue.js";
import { mountWorld, type WorldHandle } from "../../world/world.js";
import { reconcileGhosts, spotlightAddrs } from "../../world/model.js";
import { useModuleFilter, filterOf, isFiltering } from "../../state/module-filter.js";
import { emptyCopy } from "../empty-copy.js";
import { EmptyState, Text } from "../../ds/index.js";
import "../../world/world.css";

export function World({ focus }: { focus?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<WorldHandle | null>(null);
  const select = useWorld((s) => s.select);
  const setReview = useReview((s) => s.setOpen);
  // lives under ["zuzuu"] so the brain push (/ws/zuzuu) invalidates it live;
  // `definition` rides along for the in-map mini-cards' peek (C2). A DEGRADED
  // read (CLI spawn contention — e.g. racing a CLI write's index rebuild) is an
  // ERROR to retry, never truth: it once rendered a 290-note vault as "No notes
  // yet" and stuck there until the next invalidation.
  const graph = useQuery({
    queryKey: ["zuzuu", "graph"],
    queryFn: async () => {
      const g = await api.zuzuu.graph(["definition"]);
      if ((g as { degraded?: boolean }).degraded) throw new Error("map read degraded — retrying");
      return g;
    },
  });
  const { queue } = useReviewQueue(); // the aggregated cross-module staged summaries (cached, shared with the gate)

  useEffect(() => {
    if (!ref.current) return;
    const world = mountWorld(ref.current, {
      // map-first: a node click keeps the World as the stage and opens the record
      // as the wing (`note`, not `row`) — reading never leaves the map
      onSelectNote: (_addr, module, id) => select({ kind: "note", id, module }),
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

  // the module filter, spatial: the grid's active filter (shared store) becomes a
  // spotlight on the focused island — matching notes lit, the rest receding. The
  // chip row above the map (FilterChips) names the filter and clears it.
  const filter = useModuleFilter((s) => (focus ? filterOf(s.byModule, focus) : null));
  useEffect(() => {
    if (!handle.current || !graph.data) return;
    if (focus && filter && isFiltering(filter)) {
      handle.current.spotlight(spotlightAddrs(graph.data.nodes, focus, filter));
    } else {
      handle.current.spotlight(null);
    }
  }, [focus, filter, graph.data]);

  // the palette's camera commands (C3): consume once the engine has data
  const pending = useWorldCommand((s) => s.pending);
  const consume = useWorldCommand((s) => s.consume);
  useEffect(() => {
    if (!pending || !graph.data || !handle.current) return;
    const c = consume();
    if (!c) return;
    if (c.kind === "fit") handle.current.fit();
    else if (c.kind === "focusModule") handle.current.focusModule(c.module);
    else handle.current.flyTo(c.addr);
  }, [pending, graph.data, consume]);

  // the conversation's [[mention]] glow (C3 follow-up): consume fresh requests;
  // a glow queued while the map was off-stage goes stale after 8s and is dropped
  // (lighting the map minutes later would confuse, not orient)
  const glowReq = useWorldCommand((s) => s.glow);
  const consumeGlow = useWorldCommand((s) => s.consumeGlow);
  useEffect(() => {
    if (!glowReq || !graph.data || !handle.current) return;
    const g = consumeGlow();
    if (g && Date.now() - g.at < 8000) handle.current.glow(g.mentions);
  }, [glowReq, graph.data, consumeGlow]);

  // The container renders UNCONDITIONALLY — the mount effect runs once, on mount,
  // and needs the ref on the FIRST render. An early loading return meant a cold
  // cache mounted NOTHING (ref null when the effect ran; deps never re-fired) —
  // the audit's "empty black stage at steady". States overlay the container instead.
  const overlay = graph.isLoading ? (
    <Text tone="muted">loading the map…</Text>
  ) : graph.isError || !graph.data ? (
    // a failed graph read must NEVER look like a void — say so, offer retry
    <div className="flex flex-col items-center gap-2">
      <Text tone="muted">the map couldn’t load</Text>
      <Text as="button" interactive size="meta" tone="subtle" onClick={() => void graph.refetch()}>retry</Text>
    </div>
  ) : !graph.data.nodes.length ? (
    <EmptyState icon={Table2} {...emptyCopy("grid-empty")} />
  ) : null;

  return (
    <div className="relative h-full">
      <div ref={ref} className="h-full" role="img" aria-label="project map" />
      {overlay && <div className="absolute inset-0 grid place-items-center bg-app">{overlay}</div>}
    </div>
  );
}

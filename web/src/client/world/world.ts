// client/world/world.ts — the world engine: the project as a living force map.
//
// A framework-agnostic port of the startpage galaxy's two-level simulation:
// LEVEL 1 (metaSim) — each module is a physics body: hard mutual repulsion,
// collision on the island's LIVE radius (fed back from the cluster's real spread
// every tick), affinity springs derived from cross-module edge counts, gentle
// centering. LEVEL 2 (noteSim) — notes spring toward their module's live meta
// position via a custom follow force (a plain function force — forceX caches its
// accessor; this reads the moving target every tick); intra-module links at full
// strength, cross-module weak and long; rigid collide.
//
// d3 owns every element inside the container; React mounts/destroys the engine
// and feeds it data (World.tsx) — it never touches these nodes. Everything is
// keyed by ADDR (module:id) — bare ids collide across modules.

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationNodeDatum } from "d3-force";
import { select, type Selection } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { drag } from "d3-drag";
import type { WorldGhost, WorldGraph, WorldGraphNode } from "#shared/index.js";
import { deriveAffinity, modulePalette, nodeRadius, moduleHue, cardPicks, CARD_ZOOM, type AffinityLink } from "./model.js";

interface SimNode extends SimulationNodeDatum, WorldGraphNode { r: number }
interface SimLink { source: SimNode | string; target: SimNode | string; type: string; cross?: boolean }
interface MetaNode extends SimulationNodeDatum { id: string; r: number; fx?: number | null; fy?: number | null }
interface MetaLink extends Omit<AffinityLink, "source" | "target"> { source: MetaNode | string; target: MetaNode | string }
interface GhostDot extends WorldGhost { gx: number; gy: number }

export interface WorldCallbacks {
  onSelectNote?: (addr: string, module: string, id: string) => void;
  onSelectModule?: (module: string) => void;
  onGhostClick?: (module: string, stagedId: string) => void;
}

export interface WorldHandle {
  setData(graph: WorldGraph): void;
  setGhosts(ghosts: WorldGhost[]): void;
  focusModule(module: string): void;
  flyTo(addr: string): void;
  fit(): void;
  destroy(): void;
}

const asNode = (v: SimNode | string): SimNode => v as SimNode;
const asMeta = (v: MetaNode | string): MetaNode => v as MetaNode;

export function mountWorld(container: HTMLElement, cb: WorldCallbacks = {}): WorldHandle {
  container.classList.add("zz-world");
  let W = container.clientWidth || 800;
  let H = container.clientHeight || 600;

  const svg = select(container).append("svg").attr("class", "zz-world-svg");
  const scene = svg.append("g");
  const ringLayer = scene.append("g");
  const linkLayer = scene.append("g").attr("class", "zz-world-links");
  const ghostLayer = scene.append("g");
  const nodeLayer = scene.append("g");
  const labelLayer = scene.append("g").attr("class", "zz-world-labels");
  const chipLayer = select(container).append("div").attr("class", "zz-world-chips");
  const cardLayer = select(container).append("div").attr("class", "zz-world-cards");

  // ── state ──
  let nodes: SimNode[] = [];
  let links: SimLink[] = [];
  let metaNodes: MetaNode[] = [];
  let metaById = new Map<string, MetaNode>();
  let ghosts: GhostDot[] = [];
  let palette: Record<string, string> = {};
  let transform: ZoomTransform = zoomIdentity;
  let destroyed = false;
  let fitted = false;

  // ── level 1: the module world ──
  const metaSim: Simulation<MetaNode, MetaLink> = forceSimulation<MetaNode>([])
    .alphaDecay(0) // cooling is driven by the note world each tick
    .velocityDecay(0.5)
    .force("repel", forceManyBody<MetaNode>().strength(-1400))
    .force("collide", forceCollide<MetaNode>().radius((d) => d.r + 50).strength(1).iterations(2))
    .force("x", forceX<MetaNode>(W / 2).strength(0.05))
    .force("y", forceY<MetaNode>(H / 2).strength(0.06))
    .stop();

  // ── level 2: the note world ──
  function forceFollow(alpha: number): void {
    const k = 0.16 * alpha;
    for (const n of nodes) {
      const meta = metaById.get(n.module);
      if (!meta || n.x == null || n.y == null) continue;
      n.vx = (n.vx ?? 0) + ((meta.x ?? 0) - n.x) * k;
      n.vy = (n.vy ?? 0) + ((meta.y ?? 0) - n.y) * k;
    }
  }
  const sim: Simulation<SimNode, SimLink> = forceSimulation<SimNode>([])
    .velocityDecay(0.4)
    .force("charge", forceManyBody<SimNode>().strength(-90).theta(0.9).distanceMax(200))
    .force("follow", forceFollow)
    .force("collide", forceCollide<SimNode>().radius((d) => d.r + 4).strength(0.95).iterations(3))
    .stop();

  // ── zoom ──
  const zoomer: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.15, 8])
    .on("zoom", (ev: { transform: ZoomTransform }) => {
      transform = ev.transform;
      scene.attr("transform", transform.toString());
      restyle();
      placeChips();
      placeCards();
    });
  (svg as Selection<SVGSVGElement, unknown, null, undefined>).call(zoomer);

  // ── selections (rebuilt on setData) ──
  let nodeSel = nodeLayer.selectAll<SVGCircleElement, SimNode>("circle");
  let linkSel = linkLayer.selectAll<SVGLineElement, SimLink>("line");
  let labelSel = labelLayer.selectAll<SVGTextElement, SimNode>("text");
  let ringSel = ringLayer.selectAll<SVGCircleElement, string>("circle");
  let ghostSel = ghostLayer.selectAll<SVGGElement, GhostDot>("g");

  const hubMin = () => Math.max(3, Math.ceil(nodes.length / 40));

  function restyle(): void {
    const k = transform.k;
    // labels hand off to the mini-cards at card zoom (the card carries the title)
    labelSel.attr("opacity", (d) => (k >= CARD_ZOOM ? 0 : k >= 1.5 ? 0.9 : d.degree >= hubMin() ? 0.75 : 0));
    ghostSel.select("text").attr("opacity", k >= 1.2 ? 0.85 : 0);
  }

  // ── in-map mini-cards (C2 — the zoom ladder's missing rung): at k ≥ CARD_ZOOM
  // the nodes nearest the viewport center carry small read-only cards, so reading
  // never leaves the map. Screen-space HTML (like the chips), keyed by addr.
  function placeCards(): void {
    const picks = cardPicks(
      nodes.filter((n) => n.x != null && n.y != null).map((n) => ({ addr: n.addr, x: n.x ?? 0, y: n.y ?? 0 })),
      { k: transform.k, x: transform.x, y: transform.y },
      { w: W, h: H },
    );
    const byAddr = new Map(nodes.map((n) => [n.addr, n]));
    const data = picks.map((a) => byAddr.get(a)).filter((n): n is SimNode => !!n);
    const sel = cardLayer.selectAll<HTMLDivElement, SimNode>("div.zz-world-card")
      .data(data, (d) => d.addr);
    sel.exit().remove();
    const enter = sel.enter().append("div").attr("class", "zz-world-card");
    enter.append("div").attr("class", "zz-world-card-title");
    enter.append("div").attr("class", "zz-world-card-meta");
    enter.append("div").attr("class", "zz-world-card-peek");
    const all = enter.merge(sel);
    all.on("click", (_ev: MouseEvent, d) => cb.onSelectNote?.(d.addr, d.module, d.id));
    all.select<HTMLDivElement>("div.zz-world-card-title").text((d) => d.title || d.id);
    all.select<HTMLDivElement>("div.zz-world-card-meta")
      .text((d) => `${d.type}${d.status ? ` · ${d.status}` : ""}`);
    all.select<HTMLDivElement>("div.zz-world-card-peek")
      .text((d) => (d.props?.definition ?? "").slice(0, 140));
    all.style("border-color", (d) => palette[d.module] ?? "");
    all.style("transform", (d) => {
      const x = transform.applyX(d.x ?? 0);
      const y = transform.applyY((d.y ?? 0) + d.r) + 8;
      return `translate(${x}px, ${y}px) translate(-50%, 0)`;
    });
  }

  function placeChips(): void {
    chipLayer.selectAll<HTMLDivElement, MetaNode>("div.zz-world-chip")
      .style("transform", (d) => {
        const ring = ringRadius(d.id);
        const x = transform.applyX(d.x ?? 0);
        const y = transform.applyY((d.y ?? 0) - ring * transform.k) - 14;
        return `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      })
      .style("opacity", transform.k >= 3 ? "0" : "1");
  }

  const spread = new Map<string, { cx: number; cy: number; r: number }>();
  function ringRadius(module: string): number {
    return spread.get(module)?.r ?? 80;
  }

  function tick(): void {
    // the module world steps first, cooled by the note world's alpha
    metaSim.alpha(Math.max(0.003, sim.alpha()));
    metaSim.tick();

    linkSel
      .attr("x1", (d) => asNode(d.source).x ?? 0).attr("y1", (d) => asNode(d.source).y ?? 0)
      .attr("x2", (d) => asNode(d.target).x ?? 0).attr("y2", (d) => asNode(d.target).y ?? 0);
    nodeSel.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
    labelSel.attr("x", (d) => d.x ?? 0).attr("y", (d) => (d.y ?? 0) - d.r - 5);

    // island spread → rings + the meta bodies' LIVE collision radii (feedback up)
    const acc = new Map<string, { sx: number; sy: number; s2: number; n: number }>();
    for (const n of nodes) {
      const a = acc.get(n.module) ?? { sx: 0, sy: 0, s2: 0, n: 0 };
      a.sx += n.x ?? 0; a.sy += n.y ?? 0; a.n += 1;
      acc.set(n.module, a);
    }
    for (const [m, a] of acc) {
      const cx = a.sx / a.n;
      const cy = a.sy / a.n;
      let s2 = 0;
      for (const n of nodes) if (n.module === m) s2 += ((n.x ?? 0) - cx) ** 2 + ((n.y ?? 0) - cy) ** 2;
      const r = Math.sqrt(s2 / a.n) * 1.5 + 24;
      spread.set(m, { cx, cy, r });
      const meta = metaById.get(m);
      if (meta) meta.r = r;
    }
    ringSel
      .attr("cx", (m) => spread.get(m)?.cx ?? 0)
      .attr("cy", (m) => spread.get(m)?.cy ?? 0)
      .attr("r", (m) => ringRadius(m));

    // ghosts orbit their module body
    ghostSel.attr("transform", (g) => {
      const meta = metaById.get(g.module);
      const ring = ringRadius(g.module) * 0.55;
      const x = (meta?.x ?? W / 2) + Math.cos(g.gx) * ring;
      const y = (meta?.y ?? H / 2) + Math.sin(g.gx) * ring * 0.8 + g.gy;
      return `translate(${x}, ${y})`;
    });

    placeChips();
    placeCards();
  }
  sim.on("tick", tick);
  sim.on("end", () => { if (!fitted) { fitted = true; fit(); } });

  // ── chips (drag the island / click the module) ──
  function buildChips(): void {
    const sel = chipLayer.selectAll<HTMLDivElement, MetaNode>("div.zz-world-chip")
      .data(metaNodes, (d) => d.id);
    sel.exit().remove();
    const enter = sel.enter().append("div").attr("class", "zz-world-chip");
    enter.append("span").attr("class", "zz-world-chip-dot");
    enter.append("span").attr("class", "zz-world-chip-name").text((d) => d.id);
    enter.each(function (d) {
      const el = this;
      el.style.touchAction = "none";
      el.addEventListener("pointerdown", (e: PointerEvent) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        sim.alphaTarget(0.25).restart();
        d.fx = d.x; d.fy = d.y;
        let px = e.clientX;
        let py = e.clientY;
        let travelled = 0;
        const move = (ev: PointerEvent) => {
          const k = transform.k || 1;
          d.fx = (d.fx ?? 0) + (ev.clientX - px) / k;
          d.fy = (d.fy ?? 0) + (ev.clientY - py) / k;
          travelled += Math.abs(ev.clientX - px) + Math.abs(ev.clientY - py);
          px = ev.clientX; py = ev.clientY;
        };
        const up = () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          d.fx = null; d.fy = null;
          sim.alphaTarget(0);
          if (travelled < 4) cb.onSelectModule?.(d.id);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
      });
    });
    chipLayer.selectAll<HTMLDivElement, MetaNode>("div.zz-world-chip")
      .select<HTMLSpanElement>("span.zz-world-chip-dot")
      .style("background", (d) => palette[d.id] ?? "currentColor");
  }

  // ── data ──
  function setData(graph: WorldGraph): void {
    if (destroyed) return;
    const prev = new Map(nodes.map((n) => [n.addr, n]));
    const modules = [...new Set(graph.nodes.map((n) => n.module))].sort();
    palette = modulePalette(modules);

    // meta bodies keep their positions; new modules seed on a ring
    const prevMeta = metaById;
    metaNodes = modules.map((m, i) => {
      const old = prevMeta.get(m);
      const angle = (i / Math.max(1, modules.length)) * Math.PI * 2 + (moduleHue(m) / 360) * 0.5;
      return old ?? { id: m, r: 90, x: W / 2 + Math.cos(angle) * Math.min(W, H) * 0.3, y: H / 2 + Math.sin(angle) * Math.min(W, H) * 0.28 };
    });
    metaById = new Map(metaNodes.map((m) => [m.id, m]));

    nodes = graph.nodes.map((n) => {
      const old = prev.get(n.addr);
      const meta = metaById.get(n.module);
      const jitter = () => (Math.random() - 0.5) * 60;
      return {
        ...n, r: nodeRadius(n),
        x: old?.x ?? (meta?.x ?? W / 2) + jitter(),
        y: old?.y ?? (meta?.y ?? H / 2) + jitter(),
        vx: old?.vx ?? 0, vy: old?.vy ?? 0,
      };
    });
    const byAddr = new Map(nodes.map((n) => [n.addr, n]));
    const moduleOf = new Map(graph.nodes.map((n) => [n.addr, n.module]));
    links = graph.links
      .filter((l) => byAddr.has(l.source) && byAddr.has(l.target))
      .map((l) => ({ source: l.source, target: l.target, type: l.type, cross: moduleOf.get(l.source) !== moduleOf.get(l.target) }));

    // level-1 affinity springs from cross-module edge counts
    const affinity: MetaLink[] = deriveAffinity(graph.links, moduleOf).map((a) => ({ ...a }));
    metaSim.nodes(metaNodes);
    metaSim.force("affinity", forceLink<MetaNode, MetaLink>(affinity).id((d) => d.id)
      .distance((l) => Math.max(180, 460 - l.n * 14)).strength(0.06));

    sim.nodes(nodes);
    sim.force("link", forceLink<SimNode, SimLink>(links).id((d) => d.addr)
      .distance((l) => 46 + (l.cross ? 80 : 0))
      .strength((l) => (l.cross ? 0.05 : 0.25)));

    // joins
    linkSel = linkLayer.selectAll<SVGLineElement, SimLink>("line")
      .data(links, (d) => `${typeof d.source === "string" ? d.source : d.source.addr}→${typeof d.target === "string" ? d.target : d.target.addr}`)
      .join("line")
      .attr("class", (d) => (d.cross ? "zz-world-link cross" : "zz-world-link"));
    nodeSel = nodeLayer.selectAll<SVGCircleElement, SimNode>("circle")
      .data(nodes, (d) => d.addr)
      .join("circle")
      .attr("class", "zz-world-node")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => palette[d.module] ?? "currentColor")
      .attr("opacity", (d) => (d.status === "archived" || d.status === "deprecated" ? 0.45 : 0.92));
    nodeSel
      .on("click", (_ev: MouseEvent, d) => cb.onSelectNote?.(d.addr, d.module, d.id))
      .on("mouseenter", function (this: SVGCircleElement) { select(this).classed("hover", true); })
      .on("mouseleave", function (this: SVGCircleElement) { select(this).classed("hover", false); })
      .call(drag<SVGCircleElement, SimNode>()
        .on("start", (_ev, d) => { sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (ev: { dx: number; dy: number }, d) => { d.fx = (d.fx ?? 0) + ev.dx / transform.k; d.fy = (d.fy ?? 0) + ev.dy / transform.k; })
        .on("end", (_ev, d) => { d.fx = null; d.fy = null; sim.alphaTarget(0); }));
    labelSel = labelLayer.selectAll<SVGTextElement, SimNode>("text")
      .data(nodes, (d) => d.addr)
      .join("text")
      .attr("class", "zz-world-label")
      .text((d) => d.title || d.id);
    ringSel = ringLayer.selectAll<SVGCircleElement, string>("circle")
      .data(modules, (m) => m)
      .join("circle")
      .attr("class", "zz-world-ring")
      .attr("stroke", (m) => palette[m] ?? "currentColor");

    buildChips();
    rebuildGhosts();
    restyle();
    sim.alpha(prev.size ? 0.3 : 0.9).restart();
  }

  // ── ghosts (the moat in the map) ──
  let rawGhosts: WorldGhost[] = [];
  function rebuildGhosts(): void {
    const present = new Set(nodes.map((n) => n.addr));
    ghosts = rawGhosts
      .filter((g) => !present.has(g.addr))
      .map((g) => ({ ...g, gx: (moduleHue(g.stagedId) / 360) * Math.PI * 2, gy: (moduleHue(g.addr) % 20) - 10 }));
    ghostSel = ghostLayer.selectAll<SVGGElement, GhostDot>("g")
      .data(ghosts, (d) => d.addr)
      .join((enter) => {
        const g = enter.append("g").attr("class", "zz-world-ghost");
        g.append("circle").attr("r", 7);
        g.append("text").attr("y", -12).text((d) => d.title);
        return g;
      });
    ghostSel.on("click", (_ev: MouseEvent, d) => cb.onGhostClick?.(d.module, d.stagedId));
    restyle();
  }
  function setGhosts(list: WorldGhost[]): void {
    if (destroyed) return;
    rawGhosts = list;
    rebuildGhosts();
  }

  // ── camera ──
  function fit(): void {
    if (!nodes.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      x0 = Math.min(x0, n.x ?? 0); y0 = Math.min(y0, n.y ?? 0);
      x1 = Math.max(x1, n.x ?? 0); y1 = Math.max(y1, n.y ?? 0);
    }
    const k = Math.max(0.15, Math.min(2, 0.9 * Math.min(W / Math.max(1, x1 - x0 + 120), H / Math.max(1, y1 - y0 + 120))));
    const t = zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k);
    (svg as Selection<SVGSVGElement, unknown, null, undefined>).call(zoomer.transform, t);
  }
  function focusModule(module: string): void {
    const s = spread.get(module) ?? (metaById.get(module) ? { cx: metaById.get(module)!.x ?? W / 2, cy: metaById.get(module)!.y ?? H / 2, r: 120 } : null);
    if (!s) return;
    const k = Math.max(0.4, Math.min(2.4, 0.75 * Math.min(W, H) / (2 * s.r)));
    const t = zoomIdentity.translate(W / 2 - k * s.cx, H / 2 - k * s.cy).scale(k);
    (svg as Selection<SVGSVGElement, unknown, null, undefined>).call(zoomer.transform, t);
  }
  function flyTo(addr: string): void {
    const n = nodes.find((x) => x.addr === addr);
    if (!n) return;
    const k = 2.2;
    const t = zoomIdentity.translate(W / 2 - k * (n.x ?? 0), H / 2 - k * (n.y ?? 0)).scale(k);
    (svg as Selection<SVGSVGElement, unknown, null, undefined>).call(zoomer.transform, t);
  }

  // ── resize ──
  const ro = new ResizeObserver(() => {
    W = container.clientWidth || W;
    H = container.clientHeight || H;
    metaSim.force("x", forceX<MetaNode>(W / 2).strength(0.05)).force("y", forceY<MetaNode>(H / 2).strength(0.06));
    sim.alpha(0.05).restart();
  });
  ro.observe(container);

  return {
    setData,
    setGhosts,
    focusModule,
    flyTo,
    fit,
    destroy(): void {
      destroyed = true;
      ro.disconnect();
      sim.stop();
      metaSim.stop();
      select(container).selectAll("*").remove();
      container.classList.remove("zz-world");
    },
  };
}

export type { MetaLink, SimNode };

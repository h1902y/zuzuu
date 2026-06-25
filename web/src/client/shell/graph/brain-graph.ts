// shell/graph/brain-graph.ts — the whole-brain node-link graph (P3.1). Aggregates
// every module's notes into one graph; node ids are namespaced `module:id` (bare ids
// collide across modules); edges resolve [[wikilink]] references to any note by id or
// slugified title across the whole brain. Pure → tested; BrainGraph.tsx renders the SVG.
import type { ModuleItem } from "#shared/index.js";

export interface BrainNode { id: string; title: string; module: string }
export interface BrainEdge { from: string; to: string }
export interface BrainGraphData { nodes: BrainNode[]; edges: BrainEdge[] }

export interface ModuleItems {
  module: string;
  items: Pick<ModuleItem, "id" | "title" | "body">[];
}

const WIKILINK = /\[\[([^\]]+)\]\]/g;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Split a namespaced node id back into `{ module, id }` for selection. */
export function splitNodeId(nodeId: string): { module: string; id: string } {
  const i = nodeId.indexOf(":");
  return i < 0 ? { module: "", id: nodeId } : { module: nodeId.slice(0, i), id: nodeId.slice(i + 1) };
}

/** Build the whole-brain graph from per-module item lists. A [[ref]] resolves to the
 *  source note's OWN module first (bare ids collide across modules), then falls back
 *  to a global lookup — so a same-named note never mis-targets the wrong module. */
export function brainGraph(modules: ModuleItems[]): BrainGraphData {
  const nodes: BrainNode[] = [];
  const globalById = new Map<string, string>();
  const globalBySlug = new Map<string, string>();
  const localById = new Map<string, Map<string, string>>();
  const localBySlug = new Map<string, Map<string, string>>();

  for (const m of modules) {
    const lid = new Map<string, string>();
    const lsl = new Map<string, string>();
    localById.set(m.module, lid);
    localBySlug.set(m.module, lsl);
    for (const it of m.items) {
      const key = `${m.module}:${it.id}`;
      nodes.push({ id: key, title: it.title || it.id, module: m.module });
      lid.set(it.id, key);
      lsl.set(slug(it.title || it.id), key);
      if (!globalById.has(it.id)) globalById.set(it.id, key);
      const s = slug(it.title || it.id);
      if (!globalBySlug.has(s)) globalBySlug.set(s, key);
    }
  }

  const resolve = (module: string, ref: string): string | undefined => {
    const lid = localById.get(module);
    const lsl = localBySlug.get(module);
    const s = slug(ref);
    return lid?.get(ref) ?? lsl?.get(s) ?? globalById.get(ref) ?? globalBySlug.get(s);
  };

  const edges: BrainEdge[] = [];
  const seen = new Set<string>();
  for (const m of modules) {
    for (const it of m.items) {
      const from = `${m.module}:${it.id}`;
      const body = it.body ?? "";
      let mm: RegExpExecArray | null;
      WIKILINK.lastIndex = 0;
      while ((mm = WIKILINK.exec(body)) !== null) {
        const to = resolve(m.module, mm[1]!.trim());
        if (!to || to === from) continue;
        const k = `${from}->${to}`;
        if (seen.has(k)) continue;
        seen.add(k);
        edges.push({ from, to });
      }
    }
  }
  return { nodes, edges };
}

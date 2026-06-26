// shell/stage/module-graph.ts — the per-module node-link graph (P2.7). Nodes are the
// module's notes; edges are [[wikilink]] references in each note's body, resolved to
// another note by id or slugified title (the note model's native link syntax). Plus a
// dependency-free circular layout. Pure → tested; ModuleGraph.tsx renders the SVG.
import type { ModuleItem } from "#shared/index.js";

export interface GraphNode { id: string; title: string }
export interface GraphEdge { from: string; to: string }
export interface ModuleGraphData { nodes: GraphNode[]; edges: GraphEdge[] }

const WIKILINK = /\[\[([^\]]+)\]\]/g;

/** Loose slug for matching a [[ref]] to a note's title. */
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Build the graph: nodes = notes; edges = body [[wikilink]]s resolved to a sibling
 *  note by id or slug. Self-links, unresolved refs, and duplicates are dropped. */
export function moduleGraph(items: Pick<ModuleItem, "id" | "title" | "body">[]): ModuleGraphData {
  const nodes = items.map((i) => ({ id: i.id, title: i.title || i.id }));
  const byId = new Set(items.map((i) => i.id));
  const bySlug = new Map<string, string>();
  for (const i of items) bySlug.set(slug(i.title || i.id), i.id);

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const body = it.body ?? "";
    let m: RegExpExecArray | null;
    WIKILINK.lastIndex = 0;
    while ((m = WIKILINK.exec(body)) !== null) {
      const ref = m[1]!.trim();
      const to = byId.has(ref) ? ref : bySlug.get(slug(ref));
      if (!to || to === it.id) continue;
      const key = `${it.id}->${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: it.id, to });
    }
  }
  return { nodes, edges };
}

export interface Point { x: number; y: number }

/** Even circular layout on the unit circle (centre 0,0, r 1); a single node sits at
 *  the centre. The .tsx scales it into the viewport. */
export function circularLayout(n: number): Point[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: Math.cos(a), y: Math.sin(a) };
  });
}

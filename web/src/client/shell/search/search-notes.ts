// shell/search/search-notes.ts — cross-note search over the whole brain (P3.2). A pure
// client-side scan of every note's title/kind/body; title hits rank above kind above
// body, with a snippet around the first body match. Pure → tested; Search.tsx renders.
import type { ModuleItem } from "#shared/index.js";

export interface SearchHit {
  module: string;
  id: string;
  title: string;
  kind: string;
  snippet: string;
}

/** A short snippet around a body match (±30 chars, whitespace-collapsed, ellipsized). */
function snippetAround(body: string, idx: number, qlen: number): string {
  const start = Math.max(0, idx - 30);
  const end = Math.min(body.length, idx + qlen + 30);
  const core = body.slice(start, end).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + core + (end < body.length ? "…" : "");
}

/** Search the brain's notes. A blank query → no hits. Title matches rank first, then
 *  kind, then body; ties break alphabetically by title. */
export function searchNotes(items: ModuleItem[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const ranked: { hit: SearchHit; rank: number }[] = [];
  for (const it of items) {
    const title = it.title || it.id;
    const body = it.body ?? "";
    const kind = it.kind ?? "";
    const inTitle = title.toLowerCase().includes(q);
    const inKind = kind.toLowerCase().includes(q);
    const bodyIdx = body.toLowerCase().indexOf(q);
    if (!inTitle && !inKind && bodyIdx < 0) continue;
    const rank = inTitle ? 0 : inKind ? 1 : 2;
    const snippet = bodyIdx >= 0 ? snippetAround(body, bodyIdx, q.length) : "";
    ranked.push({ hit: { module: it.module, id: it.id, title, kind, snippet }, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.hit.title.localeCompare(b.hit.title));
  return ranked.map((r) => r.hit);
}

// shell/stage/everything-model.ts — the pure model behind the unified Everything
// view (one table over every module — module is a COLUMN, not a silo). Fixed core
// columns (the cross-module envelope floor: every note has these), the facet rows
// (module facets from the overview; type facets from the loaded page), and the
// facet→filter mapping. Pure → tested; Everything.tsx renders this.
import type { ModuleItem } from "#shared/index.js";
import type { GridColumn } from "./grid-columns.js";

/** The unified grid's columns — the envelope floor every module shares. Custom
 *  per-module columns belong to the module's own table (one chip-click away);
 *  a union of every schema here would be a sparse wall of empties. */
export const EVERYTHING_COLUMNS: GridColumn[] = [
  { name: "title", label: "Title", type: "text", align: "left" },
  { name: "module", label: "Module", type: "text", align: "left" },
  { name: "kind", label: "Type", type: "text", align: "left" },
  { name: "status", label: "Status", type: "text", align: "left" },
];

export interface Facet {
  value: string;
  active: boolean;
}

/** The module facets: one per module (overview order), the active one marked.
 *  Clicking an active facet clears it (toggle semantics). */
export function moduleFacets(modules: readonly { id: string }[], active: string): Facet[] {
  return modules.map((m) => ({ value: m.id, active: m.id === active }));
}

/** The type facets: distinct kinds present on the loaded page (an honest, cheap
 *  source — the full distinct-set would need its own aggregate round trip), the
 *  active kind always included even when the page no longer shows it. */
export function typeFacets(rows: readonly Pick<ModuleItem, "kind">[], active: string): Facet[] {
  const kinds: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const k = r.kind || "";
    if (k && !seen.has(k)) { seen.add(k); kinds.push(k); }
  }
  if (active && !seen.has(active)) kinds.unshift(active);
  return kinds.map((k) => ({ value: k, active: k === active }));
}

/** A facet click → the next filter value (toggle: clicking the active one clears). */
export const toggleFacet = (current: string, clicked: string): string =>
  current === clicked ? "" : clicked;

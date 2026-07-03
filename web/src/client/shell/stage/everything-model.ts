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

/** Distinct values of one string field present on the loaded page (an honest, cheap
 *  source — the full distinct-set would need its own aggregate round trip), the
 *  active value always included even when the page no longer shows it. Shared by
 *  the type and status facet rows (§H.3.1: facets are just suggested clauses). */
function fieldFacets(rows: readonly Record<string, unknown>[], key: string, active: string): Facet[] {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const v = typeof r[key] === "string" ? (r[key] as string) : "";
    if (v && !seen.has(v)) { seen.add(v); values.push(v); }
  }
  if (active && !seen.has(active)) values.unshift(active);
  return values.map((v) => ({ value: v, active: v === active }));
}

/** The type facets: distinct kinds present on the loaded page. */
export function typeFacets(rows: readonly Pick<ModuleItem, "kind">[], active: string): Facet[] {
  return fieldFacets(rows as readonly Record<string, unknown>[], "kind", active);
}

/** The status facets: distinct lifecycle values present on the loaded page (§H.3.1's
 *  facet row — module/type/status/tags; status additionally renders as a StatusPill
 *  elsewhere, but the facet CHIP itself is plain text like type). */
export function statusFacets(rows: readonly Pick<ModuleItem, "status">[], active: string): Facet[] {
  return fieldFacets(rows as readonly Record<string, unknown>[], "status", active);
}

/** A facet click → the next filter value (toggle: clicking the active one clears). */
export const toggleFacet = (current: string, clicked: string): string =>
  current === clicked ? "" : clicked;

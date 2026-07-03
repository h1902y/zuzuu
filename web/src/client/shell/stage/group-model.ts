// shell/stage/group-model.ts — group-by + aggregates (§H.3.3/§H.4.6), CLIENT-SIDE
// over the loaded PAGE. No daemon route serves `--group-by` through `module items`
// today — only the CLI's own `zz query --group-by` does (see the aggregate() path
// in src/cli/verbs/data.mjs) — so this is honest about its scope: it partitions/
// sums the rows already on the page, not the full server-side match set. A
// multi-page group under-counts; the true cross-page totals are a follow-up once
// a daemon aggregate route exists. Pure → tested; NotesTable renders this.
import type { ModuleItem } from "#shared/index.js";
import type { GridColumn } from "./grid-columns.js";

export interface RowGroup { value: string; rows: ModuleItem[]; sums: Record<string, number> }

const rec = (r: ModuleItem): Record<string, unknown> => r as unknown as Record<string, unknown>;

/** Every NUMBER-typed column's Σ across a row set (skips rows where the field is
 *  absent entirely — a group with no numeric data reports no sum, not a false 0). */
function sumsOf(rows: readonly ModuleItem[], cols: readonly GridColumn[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const c of cols) {
    if (c.type !== "number") continue;
    const present = rows.filter((r) => rec(r)[c.name] != null && rec(r)[c.name] !== "");
    if (!present.length) continue;
    sums[c.name] = present.reduce((acc, r) => { const v = Number(rec(r)[c.name]); return acc + (Number.isFinite(v) ? v : 0); }, 0);
  }
  return sums;
}

/** Partition rows by a column's stringified value (blank → "—"); group order is
 *  first-appearance (stable, cheap — no imposed alpha/numeric sort surprise). */
export function groupRows(rows: readonly ModuleItem[], key: string, cols: readonly GridColumn[]): RowGroup[] {
  const order: string[] = [];
  const byValue = new Map<string, ModuleItem[]>();
  for (const r of rows) {
    const raw = rec(r)[key];
    const value = raw == null || raw === "" ? "—" : String(raw);
    if (!byValue.has(value)) { byValue.set(value, []); order.push(value); }
    byValue.get(value)!.push(r);
  }
  return order.map((value) => {
    const grouped = byValue.get(value)!;
    return { value, rows: grouped, sums: sumsOf(grouped, cols) };
  });
}

/** The footer's Σ across every LOADED row (grouped or not) — same honesty caveat
 *  as the module doc above: a PAGE sum, not a true grand total, whenever the
 *  server has more matching rows than fit on one page. */
export const totalSums = sumsOf;

/** S3: is the footer's Σ a PARTIAL (page-only) sum rather than the true grand
 *  total? True whenever the server's pre-paginate `total` exceeds what's actually
 *  loaded — the exact condition under which a reader could mistake the Σ for a
 *  sum over ALL matching rows instead of just the rows on screen. TableFooter uses
 *  this to qualify/style the Σ so it never silently overclaims. */
export const isPartialSum = (total: number, loadedRows: number): boolean => total > loadedRows;

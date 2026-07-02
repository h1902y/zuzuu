// state/selection-csv.ts — client-side CSV export for a table selection (§H.3.4's
// "export selection" verb). Pure text-building; the browser-side download trigger
// lives in lib/download.ts (a side effect, kept thin and untested on purpose).
import type { ModuleItem } from "#shared/index.js";
import { chipValue } from "../shell/stage/table-model.js";

const rec = (it: ModuleItem): Record<string, unknown> => it as unknown as Record<string, unknown>;

/** A CSV-safe cell: object/array values collapse via table-model's chipValue (the
 *  SAME honest short-form the Attributes chips use) so the export never emits
 *  "[object Object]"; commas/quotes/newlines get quoted per RFC 4180. */
function csvCell(v: unknown): string {
  const s = v == null ? "" : Array.isArray(v) || typeof v === "object" ? chipValue(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows → CSV text. Column order: the envelope floor first (id/module/kind/
 *  title/status), then the union of every OTHER key across the selected rows,
 *  alphabetical — stable regardless of which row happened to load first, and
 *  every note's remaining frontmatter stays reachable (§H.2's "no attribute is
 *  unreachable," carried into the export). body/payload are excluded (they'd
 *  render "[object Object]"/wall-of-text; the record view is where those live). */
export function selectionToCsv(items: readonly ModuleItem[]): string {
  const FLOOR = ["id", "module", "kind", "title", "status"];
  const SKIP = new Set([...FLOOR, "body", "payload"]);
  const extra = new Set<string>();
  for (const it of items) {
    for (const k of Object.keys(rec(it))) if (!SKIP.has(k)) extra.add(k);
  }
  const cols = [...FLOOR, ...[...extra].sort()];
  const lines = [cols.map(csvCell).join(",")];
  for (const it of items) {
    const r = rec(it);
    lines.push(cols.map((c) => csvCell(r[c])).join(","));
  }
  return lines.join("\n");
}

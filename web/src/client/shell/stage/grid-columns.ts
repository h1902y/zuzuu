// shell/stage/grid-columns.ts — derive the grid's columns from a module's schema
// (U5 logic; the .tsx grid renders these). Declared `fields` → a typed table;
// schemaless → inferred from the union of note keys. Cell values format via the
// FieldType registry. Pure + tested.
import { columnsFor, fieldConfig, type FieldDef } from "../../data/field-registry.js";
import type { ModuleItem } from "#shared/index.js";

export interface GridColumn { name: string; label: string; type: string; align: "left" | "right" }

// not shown as columns: module is implicit, body is the record, provenance/payload
// are nested objects (they'd render "[object Object]" — surfaced in the record, not the grid)
const SKIP = new Set(["module", "body", "provenance", "payload"]);
const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Union of displayable keys across the notes (schemaless inference). */
export function inferKeys(items: ModuleItem[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    for (const k of Object.keys(it)) {
      if (!SKIP.has(k) && !seen.has(k) && (it as unknown as Record<string, unknown>)[k] != null) { seen.add(k); keys.push(k); }
    }
  }
  return keys;
}

/** The columns for a module: declared `fields` (typed) or inferred (schemaless). */
export function gridColumns(fields: FieldDef[], items: ModuleItem[]): GridColumn[] {
  const cols = columnsFor(fields, fields.length ? [] : inferKeys(items));
  return cols.map((f) => ({
    name: f.name,
    label: f.label ?? titleCase(f.name),
    type: f.type,
    align: fieldConfig(f.type).align ?? "left",
  }));
}

/** A row's value for a column, formatted for the grid cell. */
export function cellValue(item: ModuleItem, col: GridColumn): string {
  return fieldConfig(col.type).format((item as unknown as Record<string, unknown>)[col.name]);
}

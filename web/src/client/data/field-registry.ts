// data/field-registry.ts — ONE Map<FieldType, FieldConfig> that drives the grid cell,
// the record form input, and (later) schema graduation: the single joint between a
// module's `fields` schema and the UI (08's load-bearing joint). Logic-first — the
// format/parse functions are pure + tested; the React cell/input renderers (Phase D)
// read these. The 3-part split (cell · field-config · input) lands its cell+input here.
export type FieldType = "text" | "longtext" | "select" | "multi" | "link" | "date" | "number" | "bool";

/** One field's declaration on a module.md `fields` block. */
export interface FieldDef { name: string; type: FieldType; required?: boolean; label?: string; options?: string[] }

export interface FieldConfig {
  type: FieldType;
  /** grid cell + read view: a stored value → a display string */
  format(value: unknown): string;
  /** record form input: a typed string → the stored value */
  parse(input: string): unknown;
  align?: "left" | "right";
  multiline?: boolean;
}

const asString = (v: unknown): string => (v == null ? "" : String(v));

export const FIELD_REGISTRY: Record<FieldType, FieldConfig> = {
  text: { type: "text", format: asString, parse: (s) => s },
  longtext: { type: "longtext", format: asString, parse: (s) => s, multiline: true },
  select: { type: "select", format: asString, parse: (s) => s },
  multi: {
    type: "multi",
    format: (v) => (Array.isArray(v) ? v.join(", ") : asString(v)),
    parse: (s) => s.split(",").map((x) => x.trim()).filter(Boolean),
  },
  // a relation: the value is a target id; the cell shows the target's TITLE, not the
  // id (Mathesar record-summary) — resolved at render time with the items map.
  link: { type: "link", format: asString, parse: (s) => s },
  date: { type: "date", format: asString, parse: (s) => s },
  number: {
    type: "number",
    format: (v) => (v == null || v === "" ? "" : String(v)),
    parse: (s) => { const n = Number(s); return Number.isNaN(n) ? null : n; },
    align: "right",
  },
  bool: { type: "bool", format: (v) => (v ? "✓" : ""), parse: (s) => s === "true" || s === "✓" || s === "1" },
};

/** Resolve a field type to its config; an unknown type falls back to text (never crashes). */
export const fieldConfig = (type: string): FieldConfig => FIELD_REGISTRY[type as FieldType] ?? FIELD_REGISTRY.text;

/** The columns for a module: its declared `fields` (a typed table), or inferred from
 *  the union of note keys when schemaless (cards). Phase D refines inference. */
export function columnsFor(fields: FieldDef[], inferKeys: string[] = []): FieldDef[] {
  if (fields.length) return fields;
  return inferKeys.map((name) => ({ name, type: "text" as FieldType }));
}

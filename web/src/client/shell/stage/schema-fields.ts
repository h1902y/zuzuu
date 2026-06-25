// shell/stage/schema-fields.ts — extract declared FieldDefs from the /module/:key/schema
// response (P2.2). The CLI's `zz module schema <key>` returns `{ key, fields:[{name,
// type}] }`; the home fallback may be a different schema shape. Tolerant: a non-fields
// schema → [] (the grid falls back to schemaless inference); unknown field types
// coerce to "text" (fieldConfig already does this, but coercing here keeps the type honest).
import type { FieldDef, FieldType } from "../../data/field-registry.js";

const KNOWN_TYPES = new Set<string>(["text", "longtext", "select", "multi", "link", "date", "number", "bool"]);

interface RawField {
  name?: unknown;
  type?: unknown;
  label?: unknown;
  required?: unknown;
}

/** Pull the declared columns out of a (tolerant) schema response. Skips malformed
 *  entries; coerces unknown/absent types to "text". Preserves declaration order. */
export function fieldsFromSchema(schema: unknown): FieldDef[] {
  const raw = (schema as { fields?: unknown } | null)?.fields;
  if (!Array.isArray(raw)) return [];
  const out: FieldDef[] = [];
  for (const f of raw as RawField[]) {
    if (!f || typeof f.name !== "string") continue;
    const type: FieldType = KNOWN_TYPES.has(String(f.type)) ? (f.type as FieldType) : "text";
    out.push({
      name: f.name,
      type,
      ...(typeof f.label === "string" ? { label: f.label } : {}),
      ...(f.required ? { required: true } : {}),
    });
  }
  return out;
}

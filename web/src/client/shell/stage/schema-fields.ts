// shell/stage/schema-fields.ts — extract declared FieldDefs from the /module/:key/schema
// response (P2.2). Two shapes are handled: the CLI's `{ key, fields:[{name,type}] }`
// AND the CLI-absent home fallback's seeded `schema.json` (a JSON Schema with
// `properties`) — so typed columns survive in peek mode too. Tolerant: neither shape →
// [] (the grid falls back to schemaless inference); unknown types coerce to "text".
import type { FieldDef, FieldType } from "../../data/field-registry.js";

const KNOWN_TYPES = new Set<string>(["text", "longtext", "select", "multi", "link", "date", "number", "bool"]);

interface RawField {
  name?: unknown;
  type?: unknown;
  label?: unknown;
  required?: unknown;
}

/** Map a JSON-Schema `type` (the home schema.json) to a workbench FieldType. */
function fromJsonSchemaType(t: unknown): FieldType {
  switch (t) {
    case "number": case "integer": return "number";
    case "boolean": return "bool";
    case "array": return "multi";
    default: return "text";
  }
}

/** Pull the declared columns out of a (tolerant) schema response. Prefers the CLI's
 *  `fields` block; otherwise reads a JSON-Schema `properties` object; otherwise [].
 *  Skips malformed entries; coerces unknown/absent types to "text". */
export function fieldsFromSchema(schema: unknown): FieldDef[] {
  const raw = (schema as { fields?: unknown } | null)?.fields;
  if (Array.isArray(raw)) {
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

  // home fallback: a JSON Schema { properties: { name: { type } }, required?: [] }
  const props = (schema as { properties?: unknown } | null)?.properties;
  if (props && typeof props === "object") {
    const reqRaw = (schema as { required?: unknown }).required;
    const required = new Set(Array.isArray(reqRaw) ? (reqRaw as unknown[]).filter((x): x is string => typeof x === "string") : []);
    const out: FieldDef[] = [];
    for (const [name, def] of Object.entries(props as Record<string, unknown>)) {
      out.push({
        name,
        type: fromJsonSchemaType((def as { type?: unknown } | null)?.type),
        ...(required.has(name) ? { required: true } : {}),
      });
    }
    return out;
  }

  return [];
}

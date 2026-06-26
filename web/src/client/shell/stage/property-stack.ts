// shell/stage/property-stack.ts — the shared property model behind the record read-view
// (Record) and its edit form (Form) (P2.3). One schema-aware ordering: declared fields
// first (in module.md order, typed), then the remaining scalar frontmatter keys
// (inferred text). Pure → tested; the .tsx render/edit it. The title/kind/status header
// and the body block are rendered specially, so they're excluded here.
import type { ModuleItem } from "#shared/index.js";
import type { FieldDef } from "../../data/field-registry.js";
import { fieldConfig } from "../../data/field-registry.js";

/** Keys shown specially (header) or structurally (objects rendered elsewhere). */
const HEADER = new Set(["id", "module", "kind", "title", "status", "body"]);

export interface Property {
  name: string;
  label: string;
  type: string;
  value: string;
}

/** The READ-view stack: ordered, typed-formatted properties with a non-empty value.
 *  Declared fields first; then inferred scalar keys. Objects + empties are dropped. */
export function propertyStack(item: Partial<ModuleItem>, fields: FieldDef[]): Property[] {
  const rec = item as Record<string, unknown>;
  const props: Property[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (HEADER.has(f.name) || seen.has(f.name)) continue;
    seen.add(f.name);
    const raw = rec[f.name];
    if (raw == null || raw === "") continue;
    props.push({ name: f.name, label: f.label ?? f.name, type: f.type, value: fieldConfig(f.type).format(raw) });
  }
  for (const [k, v] of Object.entries(rec)) {
    if (HEADER.has(k) || seen.has(k)) continue;
    if (v == null || v === "" || typeof v === "object") continue;
    props.push({ name: k, label: k, type: "text", value: fieldConfig("text").format(v) });
  }
  return props;
}

/** The EDIT field list: the schema-aware union the Form binds to — declared fields
 *  (typed, in order, minus header/body), then the note's other scalar keys, with the
 *  body appended last as longtext. Drives form-model.buildForm. */
export function editableFieldDefs(item: Partial<ModuleItem>, fields: FieldDef[]): FieldDef[] {
  const rec = item as Record<string, unknown>;
  const out: FieldDef[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (HEADER.has(f.name) || seen.has(f.name)) continue;
    seen.add(f.name);
    out.push(f);
  }
  for (const [k, v] of Object.entries(rec)) {
    if (HEADER.has(k) || seen.has(k)) continue;
    if (v == null || typeof v === "object") continue;
    seen.add(k);
    out.push({ name: k, type: "text" });
  }
  out.push({ name: "body", type: "longtext" });
  return out;
}

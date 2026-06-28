// shell/wing/form-model.ts — the record edit form (U6 logic; the .tsx wing renders it).
// Build inputs from a module's fields + a note; track dirty fields; serialize only the
// CHANGED fields into a `change` body for the DataProvider's update (→ a pending proposal).
// Pure + tested.
import { fieldConfig, type FieldDef } from "../../data/field-registry.js";
import type { RelationChange } from "../../data/provider.js";
import type { ModuleItem } from "#shared/index.js";

export interface FormField { name: string; label: string; type: string; value: string; multiline: boolean }

/** Build the form inputs from a module's fields, seeded from the note's values. */
export function buildForm(fields: FieldDef[], item: Partial<ModuleItem>): FormField[] {
  return fields.map((f) => {
    const cfg = fieldConfig(f.type);
    return {
      name: f.name,
      label: f.label ?? f.name,
      type: f.type,
      value: cfg.format((item as Record<string, unknown>)[f.name]),
      multiline: !!cfg.multiline,
    };
  });
}

/** The fields whose edited value differs from the original (dirty). */
export function dirtyFields(original: FormField[], edited: Record<string, string>): string[] {
  return original.filter((f) => edited[f.name] != null && edited[f.name] !== f.value).map((f) => f.name);
}

/** Serialize ONLY the changed SCALAR fields into a `change` body (parsed per FieldType).
 *  `link` fields are EXCLUDED — a relation isn't a scalar frontmatter field; it stages as
 *  a relate/unrelate edge instead (see relationOps), so it never folds into an update. */
export function toChange(original: FormField[], edited: Record<string, string>): Record<string, unknown> {
  const change: Record<string, unknown> = {};
  for (const f of original) {
    if (f.type === "link") continue;
    const raw = edited[f.name];
    if (raw != null && raw !== f.value) change[f.name] = fieldConfig(f.type).parse(raw);
  }
  return change;
}

/** An (un)relate op the form will stage for a changed `link` field. */
export interface RelationOp { op: "relate" | "unrelate"; change: RelationChange }

/** Turn the changed `link` fields into relation edges from the row `fromId`: the field
 *  NAME is the relation type, the value is the target id. A cleared value (→ "") prunes
 *  the old edge (unrelate); a set value adds it (relate); a repoint does both — so the
 *  link becomes WRITABLE through the gate, never a direct row write. Pure → tested. */
export function relationOps(original: FormField[], edited: Record<string, string>, fromId: string): RelationOp[] {
  const ops: RelationOp[] = [];
  for (const f of original) {
    if (f.type !== "link") continue;
    const next = edited[f.name];
    if (next == null || next === f.value) continue; // untouched
    const oldTo = f.value.trim();
    const newTo = next.trim();
    if (oldTo) ops.push({ op: "unrelate", change: { from: fromId, type: f.name, to: oldTo } });
    if (newTo) ops.push({ op: "relate", change: { from: fromId, type: f.name, to: newTo } });
  }
  return ops;
}

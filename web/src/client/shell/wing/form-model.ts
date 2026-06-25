// shell/wing/form-model.ts — the record edit form (U6 logic; the .tsx wing renders it).
// Build inputs from a module's fields + a note; track dirty fields; serialize only the
// CHANGED fields into a `change` body for the DataProvider's update (→ a pending proposal).
// Pure + tested.
import { fieldConfig, type FieldDef } from "../../data/field-registry.js";
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

/** Serialize ONLY the changed fields into a `change` body (parsed per FieldType). */
export function toChange(original: FormField[], edited: Record<string, string>): Record<string, unknown> {
  const change: Record<string, unknown> = {};
  for (const f of original) {
    const raw = edited[f.name];
    if (raw != null && raw !== f.value) change[f.name] = fieldConfig(f.type).parse(raw);
  }
  return change;
}

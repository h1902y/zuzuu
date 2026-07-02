// shell/stage/field-config-model.ts — the field-config panel's pure model (§H.5,
// Airtable's edit-field made zuzuu): FieldDef ⟷ panel state ⟷ the daemon's
// ColumnFieldBody. Options editor + the `default: now` sentinel round-trip live
// here, pure and unit-tested without React; FieldConfigPanel.tsx renders/dispatches
// against this and is otherwise a thin view.
import type { ColumnFieldBody } from "../../lib/api.js";
import type { FieldDef, FieldType } from "../../data/field-registry.js";

export const FIELD_TYPES: FieldType[] = ["text", "longtext", "select", "multi", "link", "date", "number", "bool"];

/** The panel's own default-mode: "none" (no default) · "static" (a typed value) ·
 *  "now" (date-only — the `default: now` sentinel, resolved at CREATE time, not
 *  rewritten in the manifest — §H.5's CLI prerequisite). */
export type DefaultMode = "none" | "static" | "now";

export interface FieldConfigState {
  /** immutable once created (§H.5: "rename NOT offered — a note explains why:
   *  it's a refactor"); the ADD panel's only editable copy of it. */
  name: string;
  label: string;
  type: FieldType;
  /** the ƒ toggle — a computed column derives its value at index time. */
  computed: boolean;
  /** the computed formula text (dateAdd(a,b) today, "more builtins later"). */
  formula: string;
  /** select/multi only. */
  options: string[];
  required: boolean;
  defaultMode: DefaultMode;
  /** used when defaultMode === "static". */
  defaultValue: string;
  description: string;
}

/** Seed panel state: a blank slate for "+ column" (add mode), or an existing
 *  FieldDef's shape for "Edit column" (alter mode) — one FieldDef ⟷ state
 *  mapping either direction of the panel starts from. */
export function stateFromField(field: FieldDef | null, name = ""): FieldConfigState {
  if (!field) {
    return { name, label: "", type: "text", computed: false, formula: "", options: [], required: false, defaultMode: "none", defaultValue: "", description: "" };
  }
  const isNow = field.type === "date" && field.default === "now";
  return {
    name: field.name,
    label: field.label ?? "",
    type: field.type,
    computed: Boolean(field.computed),
    formula: field.computed ?? "",
    options: field.options ? [...field.options] : [],
    required: Boolean(field.required),
    defaultMode: isNow ? "now" : field.default ? "static" : "none",
    defaultValue: isNow ? "" : (field.default ?? ""),
    description: field.description ?? "",
  };
}

/** A stable hue for an option's pill preview (§H.4.4: "select values as colored
 *  pills, stable hues (hash)") — the SAME FNV-1a algorithm as the module palette
 *  (client/world/model.ts moduleHue), applied to the option VALUE instead of a
 *  module name. Duplicated rather than imported: shell/stage/ deliberately never
 *  reaches into world/ (a one-line pure function isn't worth a cross-domain edge). */
export function optionHue(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 360;
}

/** Options-editor ops (add/rename/remove) — pure, so the .tsx is a thin dispatch.
 *  A blank or duplicate add/rename is a no-op (never a silent "" pill or a
 *  collapsed duplicate). */
export function addOption(options: readonly string[], value: string): string[] {
  const v = value.trim();
  if (!v || options.includes(v)) return [...options];
  return [...options, v];
}
export function removeOption(options: readonly string[], value: string): string[] {
  return options.filter((o) => o !== value);
}
export function renameOption(options: readonly string[], from: string, to: string): string[] {
  const v = to.trim();
  if (!v || (v !== from && options.includes(v))) return [...options];
  return options.map((o) => (o === from ? v : o));
}

/** Does this type accept an options list? (select/multi only.) */
export const takesOptions = (type: FieldType): boolean => type === "select" || type === "multi";

/** Is the "default to current date" toggle offered? (date columns only — the
 *  `now` sentinel is meaningless, and left as a plain literal, on any other type.) */
export const offersNowDefault = (type: FieldType): boolean => type === "date";

/** A light validity gate for the Save button (shape-level; the daemon/CLI still
 *  own the real invariants — SAFE_SLUG on the name, uniqueness, etc.): a
 *  non-blank name, a known type, options present when the type needs them, and
 *  a non-blank formula when the ƒ toggle is on. */
export function isValid(state: FieldConfigState): boolean {
  if (!state.name.trim()) return false;
  if (!FIELD_TYPES.includes(state.type)) return false;
  if (takesOptions(state.type) && state.options.length === 0) return false;
  if (state.computed && !state.formula.trim()) return false;
  return true;
}

/** Panel state → the daemon's ColumnFieldBody (POST .../column or PATCH
 *  .../column/:name — Save always sends a FULL snapshot, not a diff, so add and
 *  alter share this one mapping). The ƒ toggle and the default are mutually
 *  exclusive in the UI (a derived column has no stored default): ON sends the
 *  formula and leaves `default` untouched; OFF explicitly clears any leftover
 *  formula (an edited column may have BEEN computed) and sends the chosen
 *  default mode, if any. */
export function toBody(state: FieldConfigState): ColumnFieldBody {
  const body: ColumnFieldBody = {
    type: state.type,
    required: state.required,
    label: state.label.trim(),
    description: state.description.trim(),
  };
  if (takesOptions(state.type)) body.options = state.options;
  if (state.computed) {
    body.computed = state.formula.trim();
  } else {
    body.computed = "";
    if (state.defaultMode === "now") body.default = "now";
    else if (state.defaultMode === "static" && state.defaultValue.trim()) body.default = state.defaultValue.trim();
  }
  return body;
}

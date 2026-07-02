// shell/wing/draft-model.ts — the pure model behind the New-note draft form
// (audit item 3). The old "New note" staged `{title: "Untitled note"}` blind —
// on a module with required columns the proposal could NEVER be approved (a
// poison proposal). The draft form blocks staging until the row is approvable:
// valid slug id, a type, every required declared column filled.
import type { FieldDef } from "../../data/field-registry.js";

/** Matches the CLI's id discipline (kebab/slug, fs-safe). */
export const DRAFT_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;

/** The blocking problems that make a draft unapprovable. Empty = stageable. */
export function draftProblems(
  fields: FieldDef[],
  values: Record<string, string>,
  id: string,
  type: string,
): string[] {
  const problems: string[] = [];
  if (!id.trim()) problems.push("an id is required");
  else if (!DRAFT_ID.test(id.trim())) problems.push("id must be a slug (a-z, 0-9, . _ -)");
  if (!type.trim()) problems.push("a type is required");
  for (const f of fields) {
    if (f.required && !(values[f.name] ?? "").trim()) {
      problems.push(`'${f.label ?? f.name}' is required`);
    }
  }
  return problems;
}

/** The change body a stageable draft resolves to: type + the non-empty declared
 *  fields (parsed per their FieldType by the caller) + optional title/body. */
export function draftChange(
  fields: FieldDef[],
  values: Record<string, string>,
  type: string,
  parse: (f: FieldDef, raw: string) => unknown,
): Record<string, unknown> {
  const change: Record<string, unknown> = { type: type.trim() };
  for (const f of fields) {
    const raw = (values[f.name] ?? "").trim();
    if (raw) change[f.name] = parse(f, raw);
  }
  return change;
}

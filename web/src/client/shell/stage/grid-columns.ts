// shell/stage/grid-columns.ts — derive the grid's columns from a module's schema
// (U5 logic; the .tsx grid renders these). Declared `fields` → a typed table;
// schemaless → inferred from the union of note keys. Cell values format via the
// FieldType registry. Pure + tested.
import { columnsFor, fieldConfig, type FieldDef } from "../../data/field-registry.js";
import type { ChipTone } from "../../ds/kit/Chip.js";
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

/** A row's value for a column, formatted to a plain display string (record/read view + tests). */
export function cellValue(item: ModuleItem, col: GridColumn): string {
  return fieldConfig(col.type).format((item as unknown as Record<string, unknown>)[col.name]);
}

// ── typed cells ──────────────────────────────────────────────────────────────
// The grid cell renders BY TYPE, not as flat text (09 D-grid). This is the pure
// derivation; GridCell.tsx renders the descriptor. It is TYPE-DRIVEN (a declared
// FieldType wins), and ALSO renders the well-known zuzuu domain columns (id · kind ·
// status · action) semantically even on a SCHEMALESS module — the common case under
// on-demand modules, so a grid reads "typed" before it graduates to a declared schema.

export type CellDescriptor =
  | { kind: "empty" }
  | { kind: "text"; value: string }
  | { kind: "mono"; value: string }
  | { kind: "pill"; value: string; tone: ChipTone }
  | { kind: "pills"; values: string[] }
  | { kind: "bool"; value: boolean };

/** A closed-vocabulary value → a status tone (deny/error · ask/pending · allow/done). */
export function statusTone(value: string): ChipTone {
  const s = value.toLowerCase();
  if (["deny", "block", "blocked", "error", "fail", "failed", "closed", "off"].includes(s)) return "danger";
  if (["ask", "warn", "warning", "pending", "review", "hold", "held"].includes(s)) return "warning";
  if (["allow", "ok", "done", "active", "open", "pass", "passed", "on", "success"].includes(s)) return "success";
  return "neutral";
}

/** A note_type / kind → its module identity hue (mirrors the proposal-chip mapping). */
const KIND_TONE: Record<string, ChipTone> = {
  rule: "guardrails",
  fact: "knowledge", entity: "knowledge", command: "actions",
  episode: "memory", runbook: "actions", script: "actions",
  instruction: "instructions", steering: "instructions", amendment: "instructions",
};

/** A row's value for a column → a typed render descriptor. */
export function cellDescriptor(item: ModuleItem, col: GridColumn): CellDescriptor {
  const raw = (item as unknown as Record<string, unknown>)[col.name];
  if (raw == null || raw === "") return { kind: "empty" };

  // 1) a declared FieldType wins
  switch (col.type) {
    case "bool": return { kind: "bool", value: !!raw };
    case "number": return { kind: "mono", value: String(raw) };
    case "multi": return { kind: "pills", values: Array.isArray(raw) ? raw.map(String) : [String(raw)] };
    case "select": return { kind: "pill", value: String(raw), tone: statusTone(String(raw)) };
    case "link": return { kind: "pill", value: String(raw), tone: "neutral" };
  }

  // 2) well-known zuzuu domain columns (so a schemaless grid still reads typed)
  const name = col.name.toLowerCase();
  const value = fieldConfig(col.type).format(raw);
  if (name === "id" || name.endsWith("_id")) return { kind: "mono", value };
  if (name === "kind" || name === "type") return { kind: "pill", value, tone: KIND_TONE[value.toLowerCase()] ?? "neutral" };
  if (name === "status" || name === "action") return { kind: "pill", value, tone: statusTone(value) };

  // 3) plain text
  return { kind: "text", value };
}

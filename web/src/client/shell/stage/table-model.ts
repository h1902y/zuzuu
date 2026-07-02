// shell/stage/table-model.ts — the pure model behind the zuzuu-native grid (§H).
//
// Identity is the ID (title is optional decoration — a blank first column would
// betray the envelope's own doctrine); heterogeneous rows keep a UNIFORM floor
// and surface the rest as elastic attribute chips (§H.2); every chip doubles as
// a filter clause (§H.3 — attributes surface AND become the query grammar); the
// filter input speaks the CLI's own where-grammar. All pure → tested.
import type { ModuleItem } from "#shared/index.js";
import type { GridColumn } from "./grid-columns.js";

/** Keys that never chip: structural/envelope keys the floor already shows, plus
 *  nested objects the record renders (mirrors grid-columns' SKIP). */
const CHIP_SKIP = new Set(["id", "title", "module", "kind", "status", "body", "provenance", "payload", "source", "relations"]);

export interface AttrChip { key: string; value: string }

/** A short display form for a chip value (objects/arrays collapse honestly). */
export function chipValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.slice(0, 2).map((x) => String(x)).join(", ") + (v.length > 2 ? ` +${v.length - 2}` : "");
  if (typeof v === "object") return "{…}";
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 37)}…` : s;
}

/** The row's remaining frontmatter as chips — everything the visible columns
 *  don't already show (§H.2: no attribute is unreachable). */
export function attrChips(row: ModuleItem, shownCols: readonly GridColumn[]): AttrChip[] {
  const shown = new Set(shownCols.map((c) => c.name));
  const out: AttrChip[] = [];
  for (const [k, v] of Object.entries(row as unknown as Record<string, unknown>)) {
    if (CHIP_SKIP.has(k) || shown.has(k)) continue;
    if (v == null || v === "") continue;
    out.push({ key: k, value: chipValue(v) });
  }
  return out;
}

/** 2-3 visible + '+N' (§H.2). */
export function visibleChips(chips: readonly AttrChip[], max = 3): { shown: AttrChip[]; more: number } {
  return { shown: chips.slice(0, max), more: Math.max(0, chips.length - max) };
}

/** A clickable chip → its filter clause (equality; the value as typed). Only
 *  scalar-ish values make sense as clauses; '{…}'/list summaries don't. */
export function chipClause(row: ModuleItem, key: string): string | null {
  const v = (row as unknown as Record<string, unknown>)[key];
  if (v == null || typeof v === "object") return null;
  return `${key}=${String(v)}`;
}

/** The lifecycle tone for a status pill — fixed semantic hues (§H.4.4). */
export type LifecycleTone = "seed" | "active" | "archived" | "deprecated" | null;
export function lifecycleTone(status: unknown): LifecycleTone {
  const s = String(status ?? "").toLowerCase();
  return s === "seed" || s === "active" || s === "archived" || s === "deprecated" ? s : null;
}

// ── the filter input's grammar (§H.3.1): one line, three clause kinds ─────────
// free text → FTS · `key<op>value` → a where clause · `#tag` → a tag clause
// (tags live in the EAV prop table, so a tag clause IS a where clause on `tag`).
const OPS = [">=", "<=", "!=", "=", ">", "<"] as const;
const KEY_RE = /^[a-z0-9][a-z0-9_-]*$/i;

export type InputClause =
  | { kind: "where"; clause: string }
  | { kind: "text"; text: string };

/** Parse ONE submitted token line. `#x` → tag=x; `k>=v` (longest op first) → a
 *  where clause when the key is a safe slug; anything else is FTS text. */
export function parseInputClause(raw: string): InputClause | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("#") && KEY_RE.test(t.slice(1))) return { kind: "where", clause: `tag=${t.slice(1)}` };
  for (const op of OPS) {
    const at = t.indexOf(op);
    if (at > 0) {
      const key = t.slice(0, at).trim();
      const value = t.slice(at + op.length).trim();
      if (KEY_RE.test(key) && value) return { kind: "where", clause: `${key}${op}${value}` };
      break; // an op appeared but the shape is off — treat as text
    }
  }
  return { kind: "text", text: t };
}

/** Split a where clause back into its parts for the chip display. */
export function clauseParts(clause: string): { key: string; op: string; value: string } {
  for (const op of OPS) {
    const at = clause.indexOf(op);
    if (at > 0) return { key: clause.slice(0, at), op, value: clause.slice(at + op.length) };
  }
  return { key: clause, op: "", value: "" };
}

/** Identity col + floor/schema cols + the elastic Attributes col (§H.2). The
 *  identity column subsumes any declared id/title columns. */
export const IDENTITY_COL: GridColumn = { name: "__identity", label: "Note", type: "text", align: "left" };
export const ATTRS_COL: GridColumn = { name: "__attrs", label: "Attributes", type: "text", align: "left" };
export function tableColumns(cols: readonly GridColumn[], { attrs = true } = {}): GridColumn[] {
  const rest = cols.filter((c) => c.name !== "id" && c.name !== "title" && c.name !== "__identity" && c.name !== "__attrs");
  return [IDENTITY_COL, ...rest, ...(attrs ? [ATTRS_COL] : [])];
}

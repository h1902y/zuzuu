// note/note-document-model.ts — the pure model behind NoteDocument (§H.6).
//
// One detail grammar, every container: header (identity) · lead (summary) ·
// grouped attribute cards (core / schema / relations / also-carries) · body ·
// quiet footer. This derives the GROUPS from the envelope + the module's
// declared fields; the .tsx renders them. Pure → tested.
import type { ModuleItem } from "#shared/index.js";
import type { FieldDef } from "../data/field-registry.js";
import { fieldConfig } from "../data/field-registry.js";

/** Envelope keys the groups never repeat (header/body/footer own them). */
const OWNED = new Set(["id", "title", "module", "kind", "status", "body", "definition", "relations", "provenance", "payload", "source", "tags", "created_at"]);

export interface AttrRow { key: string; label: string; value: string; formula?: string }
export interface RelationRow { rtype: string; target: string; note?: string; cite?: string }

export interface NoteGroups {
  core: AttrRow[];
  schema: AttrRow[];
  relations: RelationRow[];
  extras: AttrRow[];
}

const rec = (item: ModuleItem): Record<string, unknown> => item as unknown as Record<string, unknown>;

/** The bold summary lead: the `definition` field, else the body's first
 *  non-heading paragraph line. Absent = absent (null — no invented prose). */
export function leadOf(item: ModuleItem): string | null {
  const d = rec(item).definition;
  if (typeof d === "string" && d.trim()) return d.trim();
  const body = rec(item).body;
  if (typeof body !== "string") return null;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("```") || line.startsWith(">")) continue;
    return line.length > 240 ? `${line.slice(0, 237)}…` : line;
  }
  return null;
}

const short = (v: unknown): string => {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  if (typeof v === "object") { try { return JSON.stringify(v); } catch { return "{…}"; } }
  return String(v);
};

/** An edge entry may be a string target or `{target, note?, cite?}` (zuzuu ≥1.8). */
function edgeRows(rtype: string, v: unknown): RelationRow[] {
  const entries = Array.isArray(v) ? v : [v];
  const out: RelationRow[] = [];
  for (const e of entries) {
    if (typeof e === "string" && e) out.push({ rtype, target: e });
    else if (e && typeof e === "object") {
      const o = e as { target?: unknown; note?: unknown; cite?: unknown };
      if (typeof o.target === "string" && o.target) {
        out.push({
          rtype, target: o.target,
          ...(typeof o.note === "string" && o.note ? { note: o.note } : {}),
          ...(typeof o.cite === "string" && o.cite ? { cite: o.cite } : {}),
        });
      }
    }
  }
  return out;
}

/** Derive the §H.6 attribute groups from the envelope + declared fields. */
export function noteGroups(item: ModuleItem, fields: FieldDef[]): NoteGroups {
  const r = rec(item);
  const core: AttrRow[] = [];
  if (r.created_at != null && r.created_at !== "") core.push({ key: "created_at", label: "Created", value: short(r.created_at) });
  const tags = r.tags;
  if (Array.isArray(tags) && tags.length) core.push({ key: "tags", label: "Tags", value: tags.map(String).join(" · ") });

  const declared = new Set<string>();
  const schema: AttrRow[] = [];
  for (const f of fields) {
    declared.add(f.name);
    if (OWNED.has(f.name)) continue;
    const v = r[f.name];
    if (v == null || v === "") continue;
    schema.push({
      key: f.name,
      label: f.label ?? f.name.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: fieldConfig(f.type).format(v),
      ...(f.computed ? { formula: `ƒ ${f.computed}` } : {}),
    });
  }

  const relations: RelationRow[] = [];
  const rel = r.relations;
  if (rel && typeof rel === "object" && !Array.isArray(rel)) {
    for (const [rtype, v] of Object.entries(rel as Record<string, unknown>)) relations.push(...edgeRows(rtype, v));
  }

  const extras: AttrRow[] = [];
  for (const [k, v] of Object.entries(r)) {
    if (OWNED.has(k) || declared.has(k)) continue;
    if (v == null || v === "") continue;
    extras.push({ key: k, label: k, value: short(v) });
  }

  return { core, schema, relations, extras };
}

/** The quiet footer line: born-here provenance when the envelope carries it. */
export function bornHere(item: ModuleItem): string | null {
  const r = rec(item);
  if (typeof r.provenance === "string" && r.provenance.trim()) return r.provenance.trim();
  const src = r.source;
  if (src && typeof src === "object") {
    const s = src as { sessions?: unknown; proposal?: unknown };
    if (Array.isArray(s.sessions) && s.sessions.length) return `session ${String(s.sessions[0])}`;
    if (typeof s.proposal === "string") return `proposal ${s.proposal}`;
  }
  return null;
}

/** A full addr for a relation target (bare ids resolve to the note's own module —
 *  the map's resolver refines further; this is the tap's best guess). */
export const targetAddr = (item: ModuleItem, target: string): string =>
  target.includes(":") ? target : `${item.module}:${target}`;

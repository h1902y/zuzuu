// ds/lib/diff.ts — the ds-owned diff MODEL (U3). Re-exports the LCS body-diff engine
// verbatim (kept in shell/review/diff.ts — the tested asset; this promotion does not
// move or rewrite it, only gives ds/kit/Diff.tsx a clean same-layer import) and adds
// the NEW field-level old→new logic + the combined-rows collapse model the promoted
// Diff kit component renders. Pure, no React — tested directly in
// tests/client/diff-primitive.test.ts.
//
// Why re-export instead of physically moving the file: shell/review/diff.test.ts (the
// existing LCS regression suite, kept as-is) already pins shell/review/diff.ts's
// import path, and diff.ts's own header explicitly frames it as "the asset" this pass
// keeps, not relocates. Re-exporting here gives ds/kit/Diff.tsx a same-layer
// `../lib/diff.js` import without touching the pinned file or its test.
export { lineDiff, changeText, isUpdate } from "../../shell/review/diff.js";
export type { DiffRow } from "../../shell/review/diff.js";

import { lineDiff, changeText } from "../../shell/review/diff.js";
import type { DiffRow } from "../../shell/review/diff.js";

/** The inline/collapse-to-modal threshold (KTD: keep keyboard triage fast) — now
 *  applied to the COMBINED field+body row count, not body rows alone. */
export const COLLAPSE_AT = 8;

export interface FieldDiffRow { field: string; before: string; after: string }

// Structural/bookkeeping keys — never a "field" a human reviews as an old→new value:
// id/module route the note (not content), body is diffed via the LCS engine above,
// provenance/source/payload are nested bookkeeping objects, attributes is a
// legacy/defensive nested shape (see changeFieldMap below). `kind` is excluded
// directly on the NOTE side — it's remapped to `type` so it compares like-for-like
// against a staged change's `type` key (src/cli/args.mjs's projectRow renames the
// envelope's `type` → `kind` for the grid/API; the change record still calls it `type`).
const STRUCTURAL_SKIP = new Set(["id", "module", "body", "provenance", "source", "payload", "attributes", "kind"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The current note's comparable field map: every top-level frontmatter key except
 *  the structural ones above, with `kind` remapped to `type`. Defensive — a non-object
 *  `current` (or none, a create) degrades to `{}` rather than throwing. */
function noteFieldMap(note: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!isPlainObject(note)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(note)) {
    if (STRUCTURAL_SKIP.has(k) || v == null) continue;
    out[k] = v;
  }
  if (typeof note.kind === "string" && note.kind) out.type = note.kind;
  return out;
}

/** The staged change's proposed field map. `attributes` is a legacy/defensive nested
 *  shape (mirrors the daemon's zuzuu-peek.ts stagedPreview/changeText tolerance) —
 *  its keys fold in under the flat top-level ones the daemon actually emits today.
 *  Defensive — a non-object `change` (or none) degrades to `{}` rather than throwing,
 *  which is the honest fallback the plan calls for: field rows quietly disappear and
 *  the body LCS (computed independently in combinedDiff) still renders. */
function changeFieldMap(change: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!isPlainObject(change)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(change)) {
    if (STRUCTURAL_SKIP.has(k) || v == null) continue;
    out[k] = v;
  }
  const attrs = change.attributes;
  if (isPlainObject(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v != null && out[k] === undefined) out[k] = v;
    }
  }
  return out;
}

/** A field value → its display string (Aboard-style old→new cell). Arrays join with
 *  ", " (mirrors the grid's `multi` FieldType, data/field-registry.ts); a nested
 *  object degrades to JSON rather than "[object Object]". */
function displayValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(displayValue).join(", ");
  if (typeof v === "object") { try { return JSON.stringify(v); } catch { return String(v); } }
  return String(v);
}

/** Field-level old→new rows for an UPDATE proposal (KTD3, computed client-side from
 *  data the client already holds): one row per key the staged change ACTUALLY
 *  proposes a different value for. Iterates the CHANGE's own keys only — never the
 *  current note's — because a staged update is a merge-PATCH (src/grow/commit.mjs's
 *  mergeEdit): a key the change doesn't mention is untouched, so there's nothing to
 *  show for it. A field with no prior value shows `before: ""` (new). Never throws on
 *  an odd change shape (isPlainObject guards in the two field-map helpers above) — an
 *  unusable/empty shape just yields no rows; the body LCS still renders independently
 *  (see combinedDiff) — the honest fallback the plan calls for, not a special branch. */
export function fieldDiff(current: Record<string, unknown> | undefined, change: Record<string, unknown> | undefined): FieldDiffRow[] {
  const before = noteFieldMap(current);
  const after = changeFieldMap(change);
  const rows: FieldDiffRow[] = [];
  for (const [k, v] of Object.entries(after)) {
    const beforeText = displayValue(before[k]);
    const afterText = displayValue(v);
    if (beforeText === afterText) continue;
    rows.push({ field: k, before: beforeText, after: afterText });
  }
  return rows;
}

export interface CombinedDiff {
  /** update-only; always [] for a create. */
  fieldRows: FieldDiffRow[];
  bodyRows: DiffRow[];
  /** fieldRows.length + bodyRows.length — the ONE count the collapse rule reads. */
  total: number;
  /** total > COLLAPSE_AT — the caller shows a "show diff" control + modal instead of
   *  rendering inline. */
  collapsed: boolean;
}

/** The promoted Diff's full model: field rows (update only) ABOVE the body LCS,
 *  combined under ONE collapse-to-modal threshold (preserves the ≤COLLAPSE_AT-row
 *  inline discipline — now over field+body together, not body alone).
 *
 *  The body's "after" text is sourced differently by op, because a staged UPDATE is a
 *  merge-patch (mergeEdit only overwrites keys the change carries):
 *   - create → the full changeText fallback chain (body → pattern/action → run/exec →
 *     title) — verbatim, unchanged behavior; an action/guardrail create has no `body`
 *     key, so its "after" is the run/pattern text it lands with.
 *   - update → ONLY the note's actual `body` key. A patch that doesn't carry `body`
 *     leaves it unchanged (there's nothing to diff); falling through to changeText's
 *     pattern/run/title fallback here would wrongly compare the CURRENT body against
 *     an unrelated field's text (e.g. a pattern/action-only update).
 *  An update whose body didn't actually change (only fields moved) drops the body
 *  section entirely — an all-unchanged LCS is noise, not a diff to review. */
export function combinedDiff(opts: {
  update: boolean;
  current?: Record<string, unknown>;
  change?: Record<string, unknown>;
  beforeBody: string;
}): CombinedDiff {
  const fieldRows = opts.update ? fieldDiff(opts.current, opts.change) : [];
  const changeBody = opts.change?.body;
  const afterBody = opts.update
    ? (typeof changeBody === "string" ? changeBody : opts.beforeBody)
    : changeText(opts.change);
  const allBodyRows = lineDiff(opts.beforeBody, afterBody);
  const bodyChanged = !opts.update || allBodyRows.some((r) => r.tag !== "unchanged");
  const bodyRows = bodyChanged ? allBodyRows : [];
  const total = fieldRows.length + bodyRows.length;
  return { fieldRows, bodyRows, total, collapsed: total > COLLAPSE_AT };
}

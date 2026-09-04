// shell/stage/save-view-model.ts — U5 (live-views plan, docs/plans/2026-07-04-002)
// pure core: turn a table's CURRENT filter/group/sort (`useList().state`) plus a
// user-typed title into a `type:view` note's change body + a slug id. The
// `.tsx` (SaveViewForm.tsx) stays thin — every derivation here is a plain
// function so it's testable without a DOM/render harness (this suite has
// none, matching draft-model/view-query's own tests).
//
// The one load-bearing delegation: the `query` map is U1's own
// `listStateToViewQuery` — this module never re-derives that mapping, only
// wraps it with the title + id a save actually needs.
import { listStateToViewQuery, type ViewQuery } from "./view-query.js";
import { viewQuerySummary } from "./view-board-model.js";
import type { ListState } from "../../data/list-state.js";

/** The write body for the OPERATOR-lane create (KTD4): `{type:"view", title,
 *  query}` — exactly the shape `docs/guide/Modules-as-Tables.md`'s own
 *  `zz note create <m> <id> --change '{"type":"view", …}'` example uses. */
export interface ViewNoteChange {
  type: "view";
  title: string;
  query: ViewQuery;
  // an index signature (rather than a bare 3-field interface) so this type
  // satisfies `api.zuzuu.createRow`'s `Record<string, unknown>` change param
  // without a cast — `note.create`'s change body is genuinely a free-form
  // frontmatter bag (any module's schema could ride more keys on it).
  [key: string]: unknown;
}

const MAX_SLUG = 64;

/** A view's title → a kebab-case, filesystem-safe id — the same slug
 *  discipline the CLI's own note ids use (`src/notes/note.mjs`'s slugify):
 *  lowercase, non-alphanumeric runs collapse to one hyphen, no leading/
 *  trailing hyphen, capped so a long title can't blow past a sane filename.
 *  `seed` (a timestamp, injected so this stays pure + testable) only fires
 *  when the title slugifies to nothing (all-punctuation/whitespace) — never a
 *  silent "view" collision. Prefixed `view-` so a saved view reads as one at
 *  a glance in its module's table, matching the doc's own `view-pipeline`. */
export function viewNoteId(title: string, seed: number): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_SLUG);
  return `view-${slug || seed.toString(36)}`;
}

/** Validation (U5): a TITLE is the only required input. Empty/whitespace-only
 *  title → invalid (nothing else blocks a save — see the empty-query rule
 *  below). Empty = stageable-equivalent (mirrors draft-model's own
 *  `problems.length === 0` gate). */
export function saveViewProblems(title: string): string[] {
  const problems: string[] = [];
  if (!title.trim()) problems.push("a title is required");
  return problems;
}

/** THE EMPTY-QUERY RULE (U5, asserted explicitly per the plan): a ListState
 *  with no filter/group/sort/text/kind/status set derives a query of just
 *  `{module}` (U1's `listStateToViewQuery` omits every empty axis) — and that
 *  is a LEGAL, ALLOWED view: "every row of this module, live" is itself a
 *  meaningful saved view (an inbox / a plain module dashboard), not a
 *  degenerate case to reject. Save-as-view therefore never blocks on an empty
 *  query — `saveViewProblems`'s title check is the ONE gate. This predicate
 *  exists for callers that want to say so out loud (e.g. an "all rows" hint
 *  in the preview) — it is never consulted to disable Save.
 */
export function isEmptyQuery(query: ViewQuery): boolean {
  const { module: _module, ...rest } = query;
  return Object.keys(rest).length === 0;
}

/** The view note's change body: `{type:"view", title, query}`, `query`
 *  entirely delegated to U1's `listStateToViewQuery(state, module)`. `state`
 *  is the table's current ListState (`useList().state`); `module` is the
 *  table's own scope (the view note lands IN that module, same as the doc's
 *  `zz note create crm view-pipeline` — a view lives beside what it's about). */
export function saveViewChange(state: ListState, module: string, title: string): ViewNoteChange {
  return { type: "view", title: title.trim(), query: listStateToViewQuery(state, module) };
}

/** The form's read-only preview line (so the user sees exactly what's
 *  captured before saving) — reuses U2's `viewQuerySummary` verbatim, the
 *  SAME "grouped by X · where …" line the board header renders once opened,
 *  so preview and board never say two different things about one view. */
export function saveViewPreview(state: ListState): string {
  return viewQuerySummary(state);
}

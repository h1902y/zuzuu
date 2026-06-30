// palette/palette-rank.ts — the ⌘K Notes (content) group (U3). Builds the live,
// query-driven content group from the fetched notes: the top-3 hits, a "see all results"
// tail when there are more, a loading placeholder while the fan-out is in flight, and an
// always-present "Create a note named X" sentinel when nothing matches (so cmdk never
// shows its global empty for a note query, and the create path stages a proposal — THE
// INVERSION). Pure + tested; PaletteBody feeds it the live query + the cached notes.
import type { ModuleItem } from "#shared/index.js";
import { searchNotes } from "../shell/search/search-notes.js";
import type { PaletteCommand, PaletteGroup } from "./palette-commands.js";

export const NOTES_HEADING = "Notes";
export const NOTES_CAP = 3;

// The Notes commands are already content-filtered by searchNotes, but cmdk re-applies its
// subsequence filter to every item's `value`. Prefixing the value with the raw query makes
// the query a guaranteed subsequence (so cmdk keeps the item); the trailing discriminator
// keeps values distinct so cmdk doesn't dedupe identical rows.
const val = (query: string, disc: string) => `${query} ${disc}`;

/** The Notes group for the current ⌘K query, or null when the query is blank (no group
 *  until the user types). Order within the group is searchNotes's ranking (title>kind>body). */
export function notesGroup(query: string, notes: ModuleItem[], loading: boolean): PaletteGroup | null {
  const q = query.trim();
  if (!q) return null;

  if (loading) {
    return { heading: NOTES_HEADING, commands: [{ value: val(q, "loading"), label: "Searching notes…", action: { kind: "noop" } }] };
  }

  const hits = searchNotes(notes, q);
  if (!hits.length) {
    return {
      heading: NOTES_HEADING,
      commands: [{ value: val(q, "create"), label: `Create a note named “${q}”`, action: { kind: "create-note", query: q } }],
    };
  }

  const commands: PaletteCommand[] = hits.slice(0, NOTES_CAP).map((h) => ({
    value: val(q, `${h.module}:${h.id}`),
    label: `${h.title} — ${h.module}`,
    action: { kind: "open-note", module: h.module, id: h.id },
  }));
  if (hits.length > NOTES_CAP) {
    commands.push({ value: val(q, "see-all"), label: `See all results for “${q}”`, action: { kind: "see-all-search", query: q } });
  }
  return { heading: NOTES_HEADING, commands };
}

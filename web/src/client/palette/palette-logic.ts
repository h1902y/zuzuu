// src/client/palette/palette-logic.ts — fuzzy matching for the command palette.
//
// A tiny subsequence scorer: every query char must appear in order; tighter and
// earlier matches score lower (= better). Pure + testable; the Palette component
// only renders the ranked result.

/** Score `query` against `text`, or null if `query` isn't a subsequence of it. */
export function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let last = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += ti - last; // gaps between matched chars cost; adjacency is cheap
      last = ti;
      qi++;
    }
  }
  return qi === q.length ? score : null;
}

/** The palette's cmdk filter score (audit item 7): an EXACT substring hit wins
 *  outright (1) — a fuzzy subsequence can never outrank it (≤ 1/2). Typing
 *  "brahman" used to rank a project named via its path's scattered letters above
 *  the note literally titled brahman (Enter then SWITCHED PROJECTS). Note items'
 *  values are query-prefixed (palette-rank.val), so real note hits always take
 *  the exact branch; sentinel/Navigate ties resolve by group order. */
export function paletteFilterScore(value: string, search: string): number {
  if (!search) return 1;
  if (value.toLowerCase().includes(search.toLowerCase())) return 1;
  const s = fuzzyScore(search, value);
  return s === null ? 0 : 1 / (2 + s);
}

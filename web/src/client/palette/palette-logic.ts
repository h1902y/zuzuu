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

/** Rank `items` by their fuzzy match against `query`, best first. */
export function rank<T>(query: string, items: T[], key: (x: T) => string, limit = 50): T[] {
  return items
    .map((x) => ({ x, s: fuzzyScore(query, key(x)) }))
    .filter((r): r is { x: T; s: number } => r.s !== null)
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map((r) => r.x);
}

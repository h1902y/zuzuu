// src/notes/rows.mjs — the lossless read projection: full envelopes for a query.
//
// what: `readEnvelopes(home, addrs)` hydrates a set of `module:id` addrs to their
//       FULL on-disk envelopes (every frontmatter column, the `module` injected
//       alongside the `id`); `searchRows(home, filters)` = search the index for the
//       matching addrs, then hydrate them. The read path's ONE lossless projection.
// why:  the sqlite index row carries only {id,module,type,title,status,body} — a
//       custom frontmatter column round-trips perfectly on disk yet is INVISIBLE
//       through the index. A module is a TABLE and a custom column is a real column,
//       so the read must carry the WHOLE envelope, not the indexed five. Files are
//       the source of truth; the corpus is small (benchmarked 5000 notes / 13ms
//       search), so re-reading a page of matches off disk is negligible.
// how:  compose index.search (cheap, server-side filter + relevance order) →
//       repo.readNote (the lossless parse). Read-only — never a write path. Zero-dep.

import { search } from './index.mjs';
import { readNote } from './repo.mjs';

/**
 * Hydrate `module:id` addrs to their full on-disk envelopes — the `id` injected by
 * `readNote`, the `module` added here, every frontmatter column preserved. A missing
 * or unsafe-id note is skipped (fail-soft); input order is preserved.
 * @returns {object[]}
 */
export function readEnvelopes(home, addrs) {
  const out = [];
  for (const addr of addrs) {
    const s = String(addr);
    const i = s.indexOf(':');
    if (i < 0) continue;
    const module = s.slice(0, i);
    const id = s.slice(i + 1);
    let note = null;
    try { note = readNote(home, module, id); } catch { /* unsafe id → skip */ }
    if (note) out.push({ module, ...note });
  }
  return out;
}

/**
 * Search the index, then hydrate each match to its FULL envelope — the lossless read
 * projection (every frontmatter column survives, not just the indexed five). Defaults
 * to a high limit (it's a listing, not a top-N search).
 * @returns {object[]}
 */
export function searchRows(home, { limit = 10000, ...filters } = {}) {
  const hits = search(home, { ...filters, limit });
  return readEnvelopes(home, hits.map((h) => h.addr));
}

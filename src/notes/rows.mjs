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
//
// the filter·sort·paginate split (the module-as-table query): the FILTER and the
// pre-paginate `total` ALWAYS run in SQL (the FTS + prop indexes) — never "fetch
// everything + filter in JS". A PROMOTED-column sort (title/status/type/id) paginates
// in SQL too, so only the page is hydrated. An arbitrary EAV-column sort has no `notes`
// column to ORDER BY, so the filtered set is hydrated then sorted+sliced in JS (the
// corpus is small — benchmarked 5000 notes / 13ms — so this stays negligible).

import { search, count, SORTABLE_COLUMNS } from './index.mjs';
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
 * projection (every frontmatter column survives, not just the indexed five). The
 * module-as-table query: `filters` (text/module/type/tag/status/`where` EAV) run in
 * SQL; `sort` ({col,desc}) + `limit`/`offset` page the result. Returns the page plus
 * the pre-paginate `total` (a SQL COUNT over the same plan), so the caller can paginate.
 * @returns {{ items: object[], total: number }}
 */
export function searchRows(home, { limit = 10000, offset = 0, sort = null, ...filters } = {}) {
  const total = count(home, filters);                 // pre-paginate count (SQL COUNT, same plan)
  const lim = Number(limit) || 10000;
  const off = Number(offset) || 0;
  // promoted sort (or none): SQL does ORDER BY + LIMIT/OFFSET → hydrate just the page.
  if (!sort || SORTABLE_COLUMNS.has(sort.col)) {
    const hits = search(home, { ...filters, sort, limit: lim, offset: off });
    return { items: readEnvelopes(home, hits.map((h) => h.addr)), total };
  }
  // arbitrary EAV-column sort: hydrate the whole filtered set (its size IS `total`),
  // sort by the custom column, then slice the page. Ties break on id (deterministic).
  const hits = search(home, { ...filters, limit: total });
  const rows = readEnvelopes(home, hits.map((h) => h.addr));
  const val = (n) => String(n[sort.col] ?? '');
  rows.sort((a, b) => {
    const c = sort.desc ? val(b).localeCompare(val(a)) : val(a).localeCompare(val(b));
    return c !== 0 ? c : String(a.id).localeCompare(String(b.id));
  });
  return { items: rows.slice(off, off + lim), total };
}

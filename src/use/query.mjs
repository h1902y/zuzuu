// src/use/query.mjs — read the zuzuu, on demand.
//
// what: the `query` verb — search/filter notes and walk relations, returning
//       token-dense TOON. Brief by default; --full for bodies; --depth to walk;
//       --dry-run for a count before materializing.
// why:  context-frugal retrieval — the agent queries instead of ingesting, and
//       the answer is token-dense too. The Knowledge (read) capability.
// how:  composes notes/index primitives. The CLI handler lives in cli/index.mjs
//       (the `query` verb dispatches through the serve/api façade → queryData);
//       this module is the pure data fn (AXI: content-first, the veneer formats).

import { search, related, count } from '../notes/index.mjs';

/**
 * Pure: the query result data.
 * @returns {{ kind:'count'|'related'|'search', rows?, total?, addr? }}
 */
export function queryData(home, { text = '', module = '', type = '', tag = '', depth = 0, full = false, dryRun = false, from = '', limit = 50 } = {}) {
  if (dryRun) return { kind: 'count', total: count(home, { text, module, type, tag }) };
  if (from) return { kind: 'related', addr: from, rows: related(home, from, { depth: depth || 1, type }) };
  return { kind: 'search', rows: search(home, { text, module, type, tag, full, limit }) };
}

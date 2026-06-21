// zuzuu/capabilities/query.mjs — read the brain, on demand.
//
// what: the `query` verb — search/filter zus and walk relations, returning
//       token-dense TOON. Brief by default; --full for bodies; --depth to walk;
//       --dry-run for a count before materializing.
// why:  context-frugal retrieval — the agent queries instead of ingesting, and
//       the answer is token-dense too. The Knowledge (read) capability.
// how:  composes kernel/index primitives + kernel/toon. Pure data fn + a thin
//       CLI handler (AXI: content-first, contextual help, no prompts).

import { paths } from '../notes/store.mjs';
import { search, related, count } from '../notes/index.mjs';
import { toon } from '../notes/toon.mjs';

/**
 * Pure: the query result data.
 * @returns {{ kind:'count'|'related'|'search', rows?, total?, addr? }}
 */
export function queryData(home, { text = '', module = '', type = '', tag = '', depth = 0, full = false, dryRun = false, from = '', limit = 50 } = {}) {
  if (dryRun) return { kind: 'count', total: count(home, { text, module, type, tag }) };
  if (from) return { kind: 'related', addr: from, rows: related(home, from, { depth: depth || 1, type }) };
  return { kind: 'search', rows: search(home, { text, module, type, tag, full, limit }) };
}

/** `zz query [<module>] <text> [--type t] [--tag g] [--full] [--depth N] [--from addr] [--dry-run]` */
export function query(args = {}, log = console.log) {
  const home = paths().home;
  const positional = args._ ?? [];
  // `query <module> <text>` or `query <text>`
  let module = args.module ?? '';
  let text = '';
  if (positional.length >= 2) { module = module || positional[0]; text = positional.slice(1).join(' '); }
  else if (positional.length === 1) { text = positional[0]; }

  const opts = {
    text, module, type: args.type ?? '', tag: args.tag ?? '',
    depth: Number(args.depth) || 0, full: !!args.full, dryRun: !!args['dry-run'],
    from: args.from ?? '', limit: Number(args.limit) || 50,
  };
  const d = queryData(home, opts);

  if (args.json) { log(JSON.stringify(d)); return; }
  if (d.kind === 'count') { log(`zus[~${d.total}] (dry-run — drop --dry-run to list)`); return; }
  if (d.kind === 'related') {
    log(toon('related', d.rows, ['addr', 'hop', 'type', 'title'],
      [`query ${d.addr} --full`, 'check --broken-links']));
    return;
  }
  const fields = opts.full ? ['addr', 'type', 'title', 'status', 'body'] : ['addr', 'type', 'title', 'status'];
  log(toon('zus', d.rows, fields,
    d.rows.length ? ['query <text> --full', 'query --from <addr> --depth 2'] : ['remember a fact', 'zz enhance']));
}

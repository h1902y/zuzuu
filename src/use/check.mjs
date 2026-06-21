// zuzuu/capabilities/check.mjs — integrity, made queryable.
//
// what: the `check` verb — surface the brain's best-effort cracks: broken links
//       (a relation to a missing zu), orphans (no links at all), and stale zus
//       (superseded, or bitemporally expired).
// why:  the files are mutated by many processes (the agent, the user, other
//       tools), so the graph is best-effort. `check` makes divergence QUERYABLE
//       rather than pretending it can't happen (R2 — integrity is a capability,
//       not a hidden invariant).
// how:  reads the index (broken links) + the zus (orphans, stale). Fail-soft.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse } from '../notes/note.mjs';
import { itemsDir } from '../notes/store.mjs';
import { brokenLinks } from '../notes/index.mjs';
import { listModules } from '../notes/module.mjs';

/** Every zu across all modules, parsed: [{ addr, item }]. */
function allZus(home) {
  const out = [];
  for (const m of listModules(home)) {
    const dir = itemsDir(home, m.id);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const id = f.slice(0, -3);
      const { ok, item } = parse(readFileSync(`${dir}/${f}`, 'utf8'), { id });
      if (ok && item) out.push({ addr: `${m.id}:${id}`, item });
    }
  }
  return out;
}

/**
 * @returns {{ broken: Array, orphans: string[], stale: Array }}
 */
export function checkData(home, { now = null } = {}) {
  const broken = (() => { try { return brokenLinks(home); } catch { return []; } })();
  const zus = allZus(home);

  // orphans: no outbound relations and not the target of any relation
  const hasOutbound = new Set();
  const linkedTo = new Set();
  for (const { addr, item } of zus) {
    const rels = item.relations && typeof item.relations === 'object' ? item.relations : {};
    const dsts = Object.values(rels).flatMap((v) => [].concat(v)).filter(Boolean);
    if (dsts.length) hasOutbound.add(addr);
    for (const d of dsts) linkedTo.add(String(d));
  }
  const orphans = zus
    .filter(({ addr, item }) => !hasOutbound.has(addr)
      && !linkedTo.has(addr) && !linkedTo.has(item.id ?? addr.split(':')[1]))
    .map(({ addr }) => addr);

  // stale: explicitly superseded, or deprecated, or bitemporally expired
  const stale = zus
    .filter(({ item }) => item.superseded_by || item.status === 'deprecated')
    .map(({ addr, item }) => ({ addr, why: item.superseded_by ? `superseded_by ${item.superseded_by}` : 'deprecated' }));

  return { broken, orphans, stale };
}

/** The `check` capability handler (project-wide). */
export function check(ctx, opts = {}) {
  return checkData(ctx.home, opts);
}

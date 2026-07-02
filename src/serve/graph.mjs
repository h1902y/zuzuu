// src/serve/graph.mjs — the whole project as one graph document (nodes + links).
//
// what: `graphData(home, {props})` — every note as a node (addr-keyed), every
//       resolved relation as a link, degrees computed; an optional `props`
//       allowlist rides chosen frontmatter columns along on each node.
// why:  the map surface (the workbench's world view / any spatial frontend) needs
//       the full graph in ONE read. Before this verb, the startpage bridge imported
//       src/notes/index.mjs directly — an unversioned internal coupling this façade
//       replaces: the daemon shells `zz graph --json` through the catalog instead.
// how:  one index open, three SELECTs, one stat pass for age/size. Nodes and links
//       are keyed by FULL addr (module:id) — bare ids collide across modules.

import { statSync } from 'node:fs';
import { join } from 'node:path';
import { open as openIndex } from '../notes/index.mjs';
import { itemsDir } from '../notes/store.mjs';

/**
 * Build the project graph.
 * @param {string} home
 * @param {{props?: string[]}} [opts] frontmatter columns to carry on nodes (values are
 *   the index's stringified projection, truncated to 300 chars — a peek, not the envelope)
 * @returns {{ nodes: Array, links: Array }}
 */
export function graphData(home, { props = [] } = {}) {
  const db = openIndex(home);
  let rows, propRows, linkRows;
  try {
    rows = db.prepare('SELECT addr, module, id, type, title, status, length(body) AS blen FROM notes').all();
    propRows = props.length
      ? db.prepare(`SELECT addr, key, value FROM prop WHERE key IN (${props.map(() => '?').join(',')})`).all(...props)
      : [];
    linkRows = db.prepare('SELECT src, type, dst, note FROM link').all();
  } finally { db.close(); }

  const bag = {};
  for (const r of propRows) (bag[r.addr] ??= {})[r.key] = String(r.value).slice(0, 300);

  const now = Date.now();
  const nodes = rows.map((n) => {
    let ageDays = null;
    let bytes = 0;
    try {
      const s = statSync(join(itemsDir(home, n.module), `${n.id}.md`));
      ageDays = Math.round(Math.max(0, (now - s.mtimeMs) / 86400000) * 10) / 10;
      bytes = s.size;
    } catch { /* indexed but gone mid-read — leave nulls */ }
    return {
      addr: n.addr, id: n.id, module: n.module,
      type: n.type || 'unknown', title: n.title || '', status: n.status || null,
      degree: 0, ageDays, bytes, hasBody: (n.blen ?? 0) > 0,
      ...(bag[n.addr] ? { props: bag[n.addr] } : {}),
    };
  });

  // links between KNOWN nodes only (a dangling target is `zz check`'s finding, not
  // the map's); self-links dropped. The index already resolved bare ids to their
  // owner module, so src/dst are full addrs.
  const known = new Set(rows.map((n) => n.addr));
  const links = [];
  for (const l of linkRows) {
    if (l.src !== l.dst && known.has(l.dst)) {
      links.push({ source: l.src, target: l.dst, type: l.type, ...(l.note ? { note: l.note } : {}) });
    }
  }
  const deg = new Map();
  for (const l of links) {
    deg.set(l.source, (deg.get(l.source) ?? 0) + 1);
    deg.set(l.target, (deg.get(l.target) ?? 0) + 1);
  }
  for (const nd of nodes) nd.degree = deg.get(nd.addr) ?? 0;
  return { nodes, links };
}

// src/use/check.mjs — integrity, made queryable.
//
// what: the `check` verb — surface the zuzuu's best-effort cracks: broken links
//       (a relation to a missing note), orphans (no links at all), and stale notes
//       (explicitly superseded, or deprecated).
// why:  the files are mutated by many processes (the agent, the user, other
//       tools), so the graph is best-effort. `check` makes divergence QUERYABLE
//       rather than pretending it can't happen (R2 — integrity is a capability,
//       not a hidden invariant).
// how:  reads the index (broken links) + the notes (orphans, stale). Fail-soft.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse } from '../notes/note.mjs';
import { itemsDir } from '../notes/store.mjs';
import { brokenLinks } from '../notes/index.mjs';
import { listModules } from '../notes/module.mjs';

/** Every note across all modules, parsed: [{ addr, note }]. */
function allNotes(home) {
  const out = [];
  for (const m of listModules(home)) {
    const dir = itemsDir(home, m.id);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const id = f.slice(0, -3);
      const { ok, note } = parse(readFileSync(`${dir}/${f}`, 'utf8'), { id });
      if (ok && note) out.push({ addr: `${m.id}:${id}`, note });
    }
  }
  return out;
}

/**
 * @returns {{ broken: Array, orphans: string[], stale: Array }}
 */
function checkData(home) {
  const broken = (() => { try { return brokenLinks(home); } catch { return []; } })();
  const notes = allNotes(home);

  // orphans: no outbound relations and not the target of any relation
  const hasOutbound = new Set();
  const linkedTo = new Set();
  for (const { addr, note } of notes) {
    const rels = note.relations && typeof note.relations === 'object' ? note.relations : {};
    const dsts = Object.values(rels).flatMap((v) => [].concat(v)).filter(Boolean);
    if (dsts.length) hasOutbound.add(addr);
    for (const d of dsts) linkedTo.add(String(d));
  }
  const orphans = notes
    .filter(({ addr, note }) => !hasOutbound.has(addr)
      && !linkedTo.has(addr) && !linkedTo.has(note.id ?? addr.split(':')[1]))
    .map(({ addr }) => addr);

  // stale: explicitly superseded, or deprecated
  const stale = notes
    .filter(({ note }) => note.superseded_by || note.status === 'deprecated')
    .map(({ addr, note }) => ({ addr, why: note.superseded_by ? `superseded_by ${note.superseded_by}` : 'deprecated' }));

  return { broken, orphans, stale };
}

/** The `check` capability handler (project-wide). */
export function check(ctx) {
  return checkData(ctx.home);
}

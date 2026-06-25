// src/serve/timeline.mjs — how the brain evolved, on one timeline.
//
// what: the `log` verb — a unified, cross-module timeline of the Project's
//       generations (each = an approved evolution), newest first. Fossil's
//       all-artifacts-on-one-timeline, at the generation grain.
// why:  generations are per-module; "what changed across the whole brain, and
//       when?" had no single answer. This composes the per-module ledgers.
// how:  read each module's generation ledger, flatten, sort by mintedAt. Read-only.

import { listModules } from '../notes/module.mjs';
import { generations } from '../notes/generation.mjs';

/**
 * The Project's generation timeline (newest first), optionally one module.
 * @returns {Array<{ at, module, gen, active, from }>}
 */
export function timeline(home, { module = '', limit = 50 } = {}) {
  const mods = module ? [{ id: module }] : listModules(home);
  const rows = [];
  for (const m of mods) {
    const { generations: gens, active } = generations(home, m.id);
    for (const g of gens) rows.push({ at: g.mintedAt ?? '', module: m.id, gen: g.n, active: g.n === active, from: (g.mintedFrom || []).join('|') });
  }
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return rows.slice(0, limit);
}

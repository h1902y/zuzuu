// src/serve/digest.mjs — the deterministic session-start brief.
//
// what: a zero-network snapshot of the Project — per-module note counts + pending
//       proposals — rendered as markdown. The ONE grounding channel every host
//       reads at session start (written to .live/digest.md by the hook).
// why:  the agent opens a session already knowing what's been learned and what's
//       waiting for review. Deterministic + cheap (no model call).
// how:  query each module's count via the api façade. Shared by `zz digest`
//       (stdout) and the hook (file). Zero-dep, fail-soft.

import { open } from './api.mjs';
import { toon } from '../notes/toon.mjs';
import { readProject } from '../notes/project.mjs';
import { moduleCounts } from '../notes/index.mjs';

/** The brief as markdown text. Empty string if there's nothing to say. */
export function digestText(cwd = process.cwd()) {
  try {
    const zz = open(cwd);
    const mods = zz.modules();
    if (!mods.length) return '';
    // ONE index open + GROUP BY for all note counts (was M opens, each re-stat-ing
    // the whole corpus — this fires on every session start via the hook).
    const counts = moduleCounts(zz.home);
    const rows = mods.map((m) => ({ module: m.id, notes: counts[m.id] ?? 0, pending: zz.proposals(m.id).length }));
    // the Project's declared title (project.md manifest), falling back to the dir name
    const name = readProject(zz.home).title || cwd.split('/').filter(Boolean).pop() || 'project';
    const pending = rows.reduce((a, r) => a + r.pending, 0);
    let out = `# ${name} — session brief\n` + toon('zuzuu', rows, ['module', 'notes', 'pending']);
    if (pending) out += `\n${pending} proposal(s) awaiting review: zz review`;
    return out;
  } catch { return ''; }
}

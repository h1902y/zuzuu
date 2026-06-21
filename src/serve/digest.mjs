// zuzuu/pipelines/digest.mjs — the deterministic session-start brief.
//
// what: a zero-network snapshot of the brain — per-module zu counts + pending
//       proposals — rendered as markdown. The ONE grounding channel every host
//       reads at session start (written to .live/digest.md by the hook).
// why:  the agent opens a session already knowing what's been learned and what's
//       waiting for review. Deterministic + cheap (no model call).
// how:  query each module's count via the api façade. Shared by `zz digest`
//       (stdout) and the hook (file). Zero-dep, fail-soft.

import { open } from './api.mjs';
import { toon } from '../notes/toon.mjs';

/** The brief as markdown text. Empty string if there's nothing to say. */
export function digestText(cwd = process.cwd()) {
  try {
    const zz = open(cwd);
    const mods = zz.modules();
    if (!mods.length) return '';
    const rows = mods.map((m) => {
      const q = zz.query(m.id, { dryRun: true });
      return { module: m.id, zus: q.ok ? q.value.total : 0, pending: zz.proposals(m.id).length };
    });
    const name = cwd.split('/').filter(Boolean).pop() || 'project';
    const pending = rows.reduce((a, r) => a + r.pending, 0);
    let out = `# ${name} — session brief\n` + toon('brain', rows, ['module', 'zus', 'pending']);
    if (pending) out += `\n${pending} proposal(s) awaiting review: zz review`;
    return out;
  } catch { return ''; }
}

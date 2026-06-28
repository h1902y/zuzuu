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
import { moduleCounts, search } from '../notes/index.mjs';
import { heldSessions, heldMergeHint } from '../sessions/session-git.mjs';

// The steering addition is always-loaded into the session, so it stays LEAN: the
// Instructions module's standing notes are capped to the top-N (by id, deterministic),
// and the whole block is hard-capped by lines + chars. (Prior art: keep always-loaded
// guidance well under ~200 lines.)
const INSTRUCTIONS_TOP = 8;
const STEER_MAX_LINES = 27;   // ~25 content lines + the two leading blanks
const STEER_MAX_CHARS = 2000;

/**
 * The deterministic steering section: the Project's goals + the Instructions module's
 * standing notes (title-line each), capped. '' when there's nothing to add — so a
 * Project with no steering + no instructions yields a byte-identical brief. Zero-network.
 */
function steeringSection(zz) {
  const parts = [];
  const goals = readProject(zz.home).steering?.goals;
  if (goals && String(goals).trim()) parts.push(`## Goals\n${String(goals).trim()}`);

  const all = search(zz.home, { module: 'instructions', limit: 200 }).sort((a, b) => a.addr.localeCompare(b.addr));
  const shown = all.slice(0, INSTRUCTIONS_TOP);
  if (shown.length) {
    let s = `## Standing guidance\n` + shown.map((n) => `- ${n.title || n.addr}`).join('\n');
    if (all.length > shown.length) s += `\n- … (+${all.length - shown.length} more)`;
    parts.push(s);
  }
  if (!parts.length) return '';

  let block = '\n\n' + parts.join('\n\n');
  const lines = block.split('\n');
  if (lines.length > STEER_MAX_LINES) block = lines.slice(0, STEER_MAX_LINES).join('\n') + '\n…';
  if (block.length > STEER_MAX_CHARS) block = block.slice(0, STEER_MAX_CHARS) + '…';
  return block;
}

/** The brief as markdown text. Empty string if there's nothing to say. */
export function digestText(cwd = process.cwd()) {
  try {
    const zz = open(cwd);
    const mods = zz.modules();
    if (!mods.length) return '';
    // ONE index open + GROUP BY for all note counts (was M opens, each re-stat-ing
    // the whole corpus — this fires on every session start via the hook).
    const counts = moduleCounts(zz.home);
    const rows = mods.map((m) => ({ module: m.id, notes: counts[m.id] ?? 0, pending: zz.staged(m.id).length }));
    // the Project's declared title (project.md manifest), falling back to the dir name
    const name = readProject(zz.home).title || cwd.split('/').filter(Boolean).pop() || 'project';
    const pending = rows.reduce((a, r) => a + r.pending, 0);
    let out = `# ${name} — session brief\n` + toon('zuzuu', rows, ['module', 'notes', 'pending']);
    if (pending) out += `\n${pending} proposal(s) awaiting review: zz review`;
    // the code gate, mirroring the brain gate above: held sessions awaiting merge
    // (in-place + worktree-held; cwd is the git repo). Absent when none are held.
    const held = heldSessions(cwd);
    if (held.length) {
      // the CORRECT verb per kind (in-place → `zz session merge`; worktree → `zz
      // session worktree close <id>`), never a blanket merge that grabs the wrong branch.
      out += `\n${held.length} session(s) awaiting merge: ${heldMergeHint(held)}`;
      // why the hold (END no longer auto-lands) + the escape hatch, so a user who
      // didn't expect it sees both. A standing hint, not a one-time notice.
      out += `\n  (END now holds for review — set "autoMerge": true in .zuzuu/agent.json to restore auto-land)`;
    }
    out += steeringSection(zz); // the steering spine — goals + standing guidance, capped (Plane 3)
    return out;
  } catch { return ''; }
}

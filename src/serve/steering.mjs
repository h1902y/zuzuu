// src/serve/steering.mjs — the opener & closer (Plane 3 #2/#3).
//
// what: the user-facing session-steering surfaces. `openerText` is the recommended
//       way to BEGIN a session (the contract you paste as your first message);
//       `closerText` is the recommended way to END one. Both read `project.md`'s
//       steering block (the spine, #1) + the live Project state. Read-only + deterministic.
// why:  "initiate and end as recommended" — the user just runs `zz start` / `zz wrap`
//       and extracts the directory's value, instead of guessing how to open/close.
// how:  the **handoff** ("where you left off") is transient session run-state, so it
//       lives in the XDG state dir beside digest.md — never a tracked Project note (no
//       generation, no gate). `wrap --note` writes it; `start` surfaces it. Zero-dep.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { open } from './api.mjs';
import { readProject } from '../notes/project.mjs';
import { stateDir } from '../notes/store.mjs';
import { sessionStatus } from '../sessions/session-git.mjs';

const DEFAULT_OPENER = "State today's task, the files in scope, what's out of scope, and a Done-when signal.";
const DEFAULT_CLOSER = "Summarize what shipped, the decisions made (and why), what's blocked, and the next task.";

const handoffPath = (home) => join(stateDir(home), 'handoff.md');
const pendingCount = (zz) => zz.modules().reduce((n, m) => n + zz.staged(m.id).length, 0);
const projName = (proj, cwd) => proj.title || cwd.split('/').filter(Boolean).pop() || 'project';

/** The last session's handoff note ("where you left off"), or ''. Transient run-state. */
export function readHandoff(home) {
  try { const p = handoffPath(home); return existsSync(p) ? readFileSync(p, 'utf8').trim() : ''; }
  catch { return ''; }
}

/** Write the session handoff (overwrites). Fail-soft. */
export function writeHandoff(home, note) {
  try { mkdirSync(stateDir(home), { recursive: true }); writeFileSync(handoffPath(home), String(note).trim() + '\n'); return true; }
  catch { return false; }
}

/** The recommended session opener (user-facing) — read-only, deterministic. */
export function openerText(cwd = process.cwd()) {
  try {
    const zz = open(cwd);
    const proj = readProject(zz.home);
    let out = `# Start — ${projName(proj, cwd)}\n${proj.steering?.opener || DEFAULT_OPENER}`;
    if (proj.steering?.goals) out += `\n\nGoals: ${String(proj.steering.goals).trim()}`;
    const pending = pendingCount(zz);
    if (pending) out += `\n${pending} change(s) awaiting review — zz review`;
    // #7 — mid-session-drop recovery: a previous session that dropped mid-task left a
    // session branch with uncommitted checkpoints (a crash/closed terminal often leaves
    // HEAD *on* that branch). Surface it at the natural moment (the next opener) so it's
    // recovered, not silently abandoned. (continue/discard mechanics already exist.)
    const ss = sessionStatus(cwd);
    if (ss.active && ss.active.checkpoints > 0) {
      out += `\n\n## ⚠ Leftover session work\n${ss.active.branch} — ${ss.active.checkpoints} uncommitted checkpoint(s) from a prior session. Resume with \`zz session continue\`, or drop with \`zz session discard --yes\`.`;
    }
    const handoff = readHandoff(zz.home);
    if (handoff) out += `\n\n## Where you left off\n${handoff}`;
    return out;
  } catch { return ''; }
}

/** The recommended session closer (user-facing) — read-only, deterministic. */
export function closerText(cwd = process.cwd()) {
  try {
    const zz = open(cwd);
    const proj = readProject(zz.home);
    let out = `# Wrap — ${projName(proj, cwd)}\n${proj.steering?.closer || DEFAULT_CLOSER}`;
    const pending = pendingCount(zz);
    if (pending) out += `\n\n${pending} change(s) staged — review with zz review`;
    return out;
  } catch { return ''; }
}

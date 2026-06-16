// zuzuu/commands/session-manifest.mjs — `zuzuu session manifest|restore`: the
// portable session manifest (Wave C, L4).
//
//   zuzuu session manifest <id> [--write] [--json]   build (and optionally persist) the manifest
//   zuzuu session restore  <id> [--json]             reconstitute the session's worktree here
//
// Thin print/dispatch over session-manifest.mjs (which owns all logic, fail-soft).

import {
  buildSessionManifest,
  writeSessionManifest,
  restoreSession,
} from '../sessions/session-manifest.mjs';

export function sessionManifest(args = {}) {
  const cwd = process.cwd();
  const id = args._?.[0];
  if (!id) { console.error('usage: zuzuu session manifest <id> [--write] [--json]'); process.exit(1); }

  if (args.write) {
    const w = writeSessionManifest(cwd, id);
    if (args.json) { console.log(JSON.stringify(w)); if (!w.ok) process.exit(1); return; }
    if (w.ok) { console.log(`✓ wrote manifest ${w.path} (${w.contentHash.slice(0, 12)})`); return; }
    console.error(`✗ no recorded session matching '${id}'`);
    process.exit(1);
  }

  const m = buildSessionManifest(cwd, id);
  if (!m) { console.error(`no recorded session matching '${id}'`); process.exit(1); }
  if (args.json) { console.log(JSON.stringify(m)); return; }
  console.log(`session ${m.sessionId} · ${m.host ?? '-'} · ${m.state ?? '-'}`);
  console.log(`  title:   ${m.title}`);
  console.log(`  git:     ${m.git.commit ? m.git.commit.slice(0, 8) : '-'} on ${m.git.branch} (base ${m.git.base ?? '-'})`);
  console.log(`  trace:   ${m.trace.ref ?? '-'}`);
  console.log(`  counts:  ${m.counts.turns} turn(s) · ${m.counts.tools} tool(s) · ${m.counts.errors} error(s)`);
  console.log(`  worktree:${m.worktree ? ` ${m.worktree.present ? 'present' : 'absent'} (${m.worktree.path})` : ' -'}`);
  console.log(`  hash:    ${m.contentHash}`);
}

export function sessionRestore(args = {}) {
  const cwd = process.cwd();
  const id = args._?.[0];
  if (!id) { console.error('usage: zuzuu session restore <id> [--json]'); process.exit(1); }
  const r = restoreSession(cwd, id);
  if (args.json) { console.log(JSON.stringify(r)); if (!r.ok) process.exit(1); return; }
  if (r.ok) {
    console.log(`✓ restored ${id}${r.recreatedBranch ? ' (branch recreated from commit)' : ''} → worktree ${r.worktree} on ${r.branch}`);
    return;
  }
  console.error(`✗ cannot restore ${id}: ${r.reason}`);
  process.exit(1);
}

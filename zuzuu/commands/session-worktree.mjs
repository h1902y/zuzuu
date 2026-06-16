// zuzuu/commands/session-worktree.mjs — `zuzuu session worktree …`: the CLI seam
// for per-session git WORKTREES (Wave B concurrency). The daemon shells out here
// to open a worktree (→ spawn the agent PTY in the returned path) and to close
// one (squash-merge back to base) when the agent exits.
//
//   zuzuu session worktree open <id> [--json]            create/resume → prints path
//   zuzuu session worktree close <id> [--title t] [--json]  fold + squash-merge + remove
//   zuzuu session worktree list [--json]                 active session worktrees
//   zuzuu session worktree discard <id> --yes [--json]   drop WITHOUT merge (gated)
//
// Thin print/dispatch over session-worktree.mjs (which owns all git, fail-soft).
// Mirrors session.mjs: xxxData purity lives in the module; this is the print layer.

import {
  openSessionWorktree,
  closeSessionWorktree,
  discardSessionWorktree,
  listSessionWorktrees,
} from '../sessions/session-worktree.mjs';

export function sessionWorktree(args = {}) {
  const cwd = process.cwd();
  const sub = args._?.[0] ?? 'list';
  const id = args._?.[1];

  if (sub === 'open') {
    if (!id) { console.error('usage: zuzuu session worktree open <id> [--json]'); process.exit(1); }
    const d = openSessionWorktree(cwd, id);
    if (args.json) { console.log(JSON.stringify(d)); if (!d.ok) process.exit(1); return; }
    if (d.ok) { console.log(`✓ worktree ${d.resumed ? 'resumed' : 'created'} ${d.worktree} on ${d.branch} (base ${d.base})`); return; }
    console.error(`✗ cannot open worktree: ${d.reason}`);
    process.exit(1);
  }

  if (sub === 'close') {
    if (!id) { console.error('usage: zuzuu session worktree close <id> [--title t] [--json]'); process.exit(1); }
    const d = closeSessionWorktree(cwd, id, { title: typeof args.title === 'string' ? args.title : undefined });
    if (args.json) { console.log(JSON.stringify(d)); if (!d.ok) process.exit(1); return; }
    if (d.ok) {
      console.log(d.mergedAs
        ? `✓ squashed ${d.commits} checkpoint(s) into ${d.mergedAs.slice(0, 8)} — worktree + branch removed`
        : '✓ worktree had no changes — removed, base untouched');
      return;
    }
    console.error(d.conflict
      ? `✗ conflict squashing ${d.branch} — worktree kept for retry (resolve manually, or discard)`
      : d.reason === 'empty-squash-with-checkpoints'
        ? `✗ session had no net changes — ${d.commits} exploration checkpoint(s) retained on ${d.branch}`
        : `✗ cannot close worktree: ${d.reason}`);
    process.exit(1);
  }

  if (sub === 'discard') {
    if (!id) { console.error('usage: zuzuu session worktree discard <id> --yes'); process.exit(1); }
    if (!args.yes) {
      console.error('refusing without --yes — `zuzuu session worktree discard <id> --yes` DROPS the worktree + branch WITHOUT merging');
      process.exit(1);
    }
    const d = discardSessionWorktree(cwd, id);
    if (args.json) { console.log(JSON.stringify(d)); if (!d.ok) process.exit(1); return; }
    if (d.ok) { console.log(`✓ discarded worktree + ${d.branch} (no merge)`); return; }
    console.error(`✗ cannot discard worktree: ${d.reason}`);
    process.exit(1);
  }

  if (sub === 'list') {
    const d = listSessionWorktrees(cwd);
    if (args.json) { console.log(JSON.stringify(d)); return; }
    if (!d.length) { console.log('no active session worktrees'); return; }
    for (const w of d) console.log(`● ${w.branch}  ${w.path}`);
    return;
  }

  console.error(`unknown: zuzuu session worktree ${sub}\nusage: zuzuu session worktree [open <id>|close <id> [--title t]|list|discard <id> --yes] [--json]`);
  process.exit(1);
}

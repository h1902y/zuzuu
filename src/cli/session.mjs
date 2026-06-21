// zuzuu/cli/session.mjs — `zz session …`, the session-as-git-branch surface.
//
// what: inspect and steer the invisible per-session git substrate — status,
//       squash-merge, continue, discard; the worktree concurrency layer; the
//       portable manifest + restore; and human labels.
// why:  a session ≡ a conversation ≡ a git branch. This is the porcelain over
//       the safety-critical sessions/ engine (single-working-branch, secret-
//       excluded checkpoints, fail-soft-never-throw) — now v2-native (kernel,
//       no v1 core). The OTLP inspect/trace/tree/content subcommands are GONE
//       with the trace layer (v2 mines transcripts directly).
// how:  a thin sub-dispatch onto sessions/*; brief output. Zero-dep.

import { sessionStatus, closeSession, continueSession, discardSession } from '../sessions/session-git.mjs';
import { openSessionWorktree, closeSessionWorktree, listSessionWorktrees, discardSessionWorktree } from '../sessions/session-worktree.mjs';
import { writeSessionManifest, buildSessionManifest, listSessionManifests, restoreSession } from '../sessions/session-manifest.mjs';
import { readSessionLabels, setSessionLabel } from '../sessions/labels.mjs';
import { toon } from '../notes/toon.mjs';

/** The leftover-branch nudge (shared shape with doctor): a string or null. */
export function leftoverWarning(ss) {
  if (!ss?.active || ss.onSessionBranch) return null;
  if (ss.active.noNetChanges) return `session branch ${ss.active.branch} has no net changes — ${ss.active.checkpoints} checkpoint(s) retained; \`zz session discard --yes\` to drop`;
  return `leftover session branch ${ss.active.branch} (${ss.active.checkpoints} checkpoint(s)) — zz session continue | merge | discard`;
}

export function sessionCommand(args, cwd, log) {
  const sub = args._[0] ?? 'status';
  const fail = (m) => { log(toon('error', [{ message: m }], ['message'])); return 1; };

  switch (sub) {
    case 'status': {
      const s = sessionStatus(cwd);
      log(toon('session', [{ enabled: s.enabled, main: s.mainBranch ?? '', branch: s.active?.branch ?? '', checkpoints: s.active?.checkpoints ?? 0, onBranch: s.onSessionBranch }], ['enabled', 'main', 'branch', 'checkpoints', 'onBranch']));
      const w = leftoverWarning(s);
      if (w) log(w);
      return 0;
    }
    case 'merge': {
      const r = closeSession(cwd, { title: args.title });
      if (r.ok) { log(r.mergedAs ? `✓ squashed ${r.commits} checkpoint(s) into ${r.mergedAs.slice(0, 8)} — branch removed` : '✓ nothing to merge'); return 0; }
      return fail(r.conflict ? `conflict squashing ${r.branch} — aborted, branch intact` : (r.reason ?? 'cannot merge'));
    }
    case 'continue': {
      const r = continueSession(cwd);
      if (r.ok) { log(`✓ back on ${r.branch} — finish, then \`zz session merge\``); return 0; }
      return fail(r.reason ?? 'cannot continue');
    }
    case 'discard': {
      if (!args.yes) return fail('refusing without --yes — DELETES the session branch and its checkpoints');
      const r = discardSession(cwd);
      if (r.ok) { log(`✓ discarded ${r.branch}`); return 0; }
      return fail(r.reason ?? 'cannot discard');
    }
    case 'worktree': return worktree({ ...args, _: args._.slice(1) }, cwd, log, fail);
    case 'manifest': {
      const id = args._[1];
      if (!id) { log(toon('manifests', listSessionManifests(cwd).map((m) => ({ id: m.id, host: m.host ?? '', hash: (m.hash ?? '').slice(0, 8) })), ['id', 'host', 'hash'])); return 0; }
      const r = args.write ? writeSessionManifest(cwd, id) : buildSessionManifest(cwd, id);
      if (!r) return fail(`no session '${id}'`);
      log(toon('manifest', [{ id: r.id, host: r.host ?? '', branch: r.git?.branch ?? '', hash: (r.hash ?? '').slice(0, 8), written: !!args.write }], ['id', 'host', 'branch', 'hash', 'written']));
      return 0;
    }
    case 'restore': {
      const id = args._[1];
      if (!id) return fail('usage: zz session restore <id>');
      const r = restoreSession(cwd, id);
      if (r.ok) { log(`✓ restored ${id}${r.worktree ? ` at ${r.worktree}` : ''}${r.recreatedBranch ? ' (branch recreated)' : ''}`); return 0; }
      return fail(r.reason ?? 'cannot restore');
    }
    case 'label': {
      const id = args._[1];
      if (!id) { log(toon('labels', Object.entries(readSessionLabels(cwd)).map(([k, v]) => ({ id: k, label: v })), ['id', 'label'])); return 0; }
      setSessionLabel(cwd, id, args.text ?? '');
      log(`✓ ${args.text ? `labeled ${id}` : `cleared label for ${id}`}`);
      return 0;
    }
    default:
      return fail(`unknown: zz session ${sub} — try: status|merge|continue|discard|worktree|manifest|restore|label`);
  }
}

function worktree(args, cwd, log, fail) {
  const op = args._[0];
  const id = args._[1];
  switch (op) {
    case 'open': {
      if (!id) return fail('usage: zz session worktree open <id>');
      const r = openSessionWorktree(cwd, id);
      if (r.ok) { log(`✓ worktree ${id} at ${r.dir}`); return 0; }
      return fail(r.reason ?? 'cannot open worktree');
    }
    case 'close': {
      if (!id) return fail('usage: zz session worktree close <id>');
      const r = closeSessionWorktree(cwd, id, { title: args.title });
      if (r.ok) { log(`✓ closed worktree ${id}`); return 0; }
      return fail(r.conflict ? `conflict closing ${id} — worktree+branch kept` : (r.reason ?? 'cannot close'));
    }
    case 'discard': {
      if (!id) return fail('usage: zz session worktree discard <id>');
      const r = discardSessionWorktree(cwd, id);
      return r.ok ? (log(`✓ discarded worktree ${id}`), 0) : fail(r.reason ?? 'cannot discard');
    }
    case 'list':
    case undefined:
      log(toon('worktrees', listSessionWorktrees(cwd).map((w) => ({ id: w.sessionId ?? w.id, branch: w.branch ?? '', dir: w.dir ?? '' })), ['id', 'branch', 'dir']));
      return 0;
    default:
      return fail(`unknown: zz session worktree ${op}`);
  }
}

// src/cli/session.mjs — `zz session …`, the session-as-git-branch surface.
//
// what: inspect and steer the invisible per-session git substrate — status,
//       squash-merge, continue, discard; the worktree concurrency layer; and
//       human labels.
// why:  a session ≡ a conversation ≡ a git branch. This is the porcelain over
//       the safety-critical sessions/ engine (single-working-branch, secret-
//       excluded checkpoints, fail-soft-never-throw) — now v2-native (notes-backed,
//       no v1 core). The OTLP inspect/trace/tree/content subcommands are GONE
//       with the trace layer (v2 mines transcripts directly).
// how:  a thin sub-dispatch onto sessions/*; brief output. Zero-dep.

import { sessionStatus, closeSession, continueSession, discardSession, finalizeSession, heldSessions, heldMergeHint, sessionReview } from '../sessions/session-git.mjs';
import { openSessionWorktree, closeSessionWorktree, finalizeSessionWorktree, listSessionWorktrees, discardSessionWorktree } from '../sessions/session-worktree.mjs';
import { readSessionLabels, setSessionLabel } from '../sessions/labels.mjs';
import { toon } from '../notes/toon.mjs';

/** The leftover-branch nudge (shared shape with doctor): a string or null. */
export function leftoverWarning(ss) {
  if (!ss?.active || ss.onSessionBranch) return null;
  if (ss.active.noNetChanges) return `session branch ${ss.active.branch} has no net changes — ${ss.active.checkpoints} checkpoint(s) retained; \`zz session discard --yes\` to drop`;
  return `leftover session branch ${ss.active.branch} (${ss.active.checkpoints} checkpoint(s)) — zz session continue | merge | discard`;
}

export function sessionCommand(args, cwd, log, warn) {
  const sub = args._[0] ?? 'status';
  const fail = (m) => { log(toon('error', [{ message: m }], ['message'])); return 1; };
  // the renamed verbs (merge/finalize/continue/discard → land/hold/resume/drop) still
  // work; they emit ONE stderr deprecation and run unchanged. The new names auto-detect
  // worktree vs in-place (land/hold) — the only behaviour the rename adds.
  const deprecate = (to) => { if (warn) warn(`zz: 'session ${sub}' is deprecated — use 'session ${to}'`); };

  switch (sub) {
    case 'status': {
      const s = sessionStatus(cwd);
      // EVERY held session (in-place `zz/held-*` + worktree-held `zz/session-*`),
      // each with its merge-review summary — not just branches[0]. This is the
      // code-gate queue, mirroring `zz review` for the brain gate.
      const heldEntries = heldSessions(cwd);
      const held = heldEntries.map(({ branch, kind }) => {
        const r = sessionReview(cwd, branch);
        return r.ok
          ? { branch, kind, checkpoints: r.checkpoints, files: r.files, added: r.added, removed: r.removed, mergeability: r.mergeability }
          : { branch, kind, checkpoints: 0, files: 0, added: 0, removed: 0, mergeability: 'unknown' };
      });
      if (args.json) {
        log(JSON.stringify({ enabled: s.enabled, main: s.mainBranch ?? null, active: s.active ?? null, onSessionBranch: s.onSessionBranch, held }));
        return 0;
      }
      log(toon('session', [{ enabled: s.enabled, main: s.mainBranch ?? '', branch: s.active?.branch ?? '', checkpoints: s.active?.checkpoints ?? 0, onBranch: s.onSessionBranch }], ['enabled', 'main', 'branch', 'checkpoints', 'onBranch']));
      if (held.length) {
        log(toon('held', held, ['branch', 'kind', 'checkpoints', 'files', 'added', 'removed', 'mergeability']));
        // the CORRECT verb per kind — never a blanket `zz session merge` (it would
        // grab the wrong branch for a worktree-held session).
        log(`${held.length} session(s) awaiting merge — ${heldMergeHint(heldEntries)}`);
      }
      const w = leftoverWarning(s);
      if (w) log(w);
      return 0;
    }
    // ── land/hold/resume/drop (canonical) + merge/finalize/continue/discard (aliases) ──
    case 'land':
    case 'merge': {
      if (sub === 'merge') deprecate('land');
      // optional id (`zz session land [<id>]`) resolves a SPECIFIC held/active branch;
      // without it, the single active-or-held one (ambiguous → refuse). Auto-detect: a
      // worktree-held session (by id, or the sole one) lands via the worktree close path.
      const id = args._[1];
      const wt = heldSessions(cwd).filter((e) => e.kind === 'worktree');
      const match = id != null ? wt.find((e) => e.id === id) : (wt.length === 1 ? wt[0] : null);
      if (match) return worktree({ ...args, _: ['close', match.id] }, cwd, log, fail);
      const r = closeSession(cwd, { title: args.title, id });
      if (args.json) { log(JSON.stringify(r)); return r.ok ? 0 : 1; }
      if (r.ok) { log(r.mergedAs ? `✓ squashed ${r.commits} checkpoint(s) into ${r.mergedAs.slice(0, 8)} — branch removed` : '✓ nothing to merge'); return 0; }
      if (r.reason === 'ambiguous-session') return fail('multiple held sessions — name one: `zz session land <id>` (see `zz session status`)');
      return fail(r.conflict ? `conflict squashing ${r.branch} — aborted, branch intact; resolve with \`zz session resume\`, then \`zz session land\`` : (r.reason ?? 'cannot merge'));
    }
    case 'hold':
    case 'finalize': {
      if (sub === 'finalize') deprecate('hold');
      // END holds (never merges): fold uncommitted work, hold the branch out of the
      // active namespace for the explicit merge gate. Auto-detect: a worktree session
      // (named by id) holds via the worktree finalize path. The daemon (agent-close)
      // shells this with --json on PTY exit for an in-place agent; humans see the prose.
      const id = args._[1];
      const wtIds = listSessionWorktrees(cwd).map((w) => (w.branch ?? '').slice('zz/session-'.length));
      if (id != null && wtIds.includes(id)) return worktree({ ...args, _: ['finalize', id] }, cwd, log, fail);
      const r = finalizeSession(cwd);
      if (args.json) { log(JSON.stringify(r)); return r.ok ? 0 : 1; }
      if (r.ok) { log(`✓ held ${r.held} (${r.checkpoints} checkpoint(s)) — \`zz session land\` to land`); return 0; }
      return fail(r.reason ?? 'cannot finalize');
    }
    case 'resume':
    case 'continue': {
      if (sub === 'continue') deprecate('resume');
      const id = args._[1];
      const r = continueSession(cwd, id);
      if (r.ok) { log(`✓ back on ${r.branch} — finish, then \`zz session land\``); return 0; }
      if (r.reason === 'ambiguous-session') return fail('multiple held sessions — name one: `zz session resume <id>`');
      return fail(r.reason ?? 'cannot continue');
    }
    case 'drop':
    case 'discard': {
      if (sub === 'discard') deprecate('drop');
      if (!args.yes) return fail('refusing without --yes — DELETES the session branch and its checkpoints');
      const id = args._[1];
      const r = discardSession(cwd, id);
      if (r.ok) { log(`✓ discarded ${r.branch}`); return 0; }
      if (r.reason === 'ambiguous-session') return fail('multiple held sessions — name one: `zz session drop <id> --yes`');
      return fail(r.reason ?? 'cannot discard');
    }
    case 'worktree': return worktree({ ...args, _: args._.slice(1) }, cwd, log, fail);
    case 'label': {
      const id = args._[1];
      if (!id) { log(toon('labels', Object.entries(readSessionLabels(cwd)).map(([k, v]) => ({ id: k, label: v })), ['id', 'label'])); return 0; }
      setSessionLabel(cwd, id, args.text ?? '');
      log(`✓ ${args.text ? `labeled ${id}` : `cleared label for ${id}`}`);
      return 0;
    }
    default:
      return fail(`unknown: zz session ${sub} — try: status|land|hold|resume|drop|worktree|label`);
  }
}

function worktree(args, cwd, log, fail) {
  const op = args._[0];
  const id = args._[1];
  switch (op) {
    case 'open': {
      if (!id) return fail('usage: zz session worktree open <id>');
      const r = openSessionWorktree(cwd, id);
      if (r.ok) { log(`✓ worktree ${id} at ${r.worktree}`); return 0; }
      return fail(r.reason ?? 'cannot open worktree');
    }
    case 'close': {
      if (!id) return fail('usage: zz session worktree close <id>');
      const r = closeSessionWorktree(cwd, id, { title: args.title });
      if (args.json) { log(JSON.stringify(r)); return r.ok ? 0 : 1; }
      if (r.ok) { log(`✓ closed worktree ${id}`); return 0; }
      return fail(r.conflict ? `conflict closing ${id} — worktree+branch kept` : (r.reason ?? 'cannot close'));
    }
    case 'finalize': {
      // END holds (never merges): fold uncommitted work, leave the worktree+branch
      // held for the explicit merge gate. The daemon (agent-close) shells this with
      // --json on PTY exit; humans see the prose.
      if (!id) return fail('usage: zz session worktree finalize <id>');
      const r = finalizeSessionWorktree(cwd, id);
      if (args.json) { log(JSON.stringify(r)); return r.ok ? 0 : 1; }
      if (r.ok) { log(`✓ held worktree ${id} on ${r.held} (${r.checkpoints} checkpoint(s)) — \`zz session worktree close ${id}\` to merge`); return 0; }
      return fail(r.reason ?? 'cannot finalize');
    }
    case 'discard': {
      if (!id) return fail('usage: zz session worktree discard <id>');
      // symmetric with the in-place `zz session discard` guard: dropping a held
      // worktree DELETES its branch + checkpoints — never without an explicit --yes.
      if (!args.yes) return fail('refusing without --yes — DELETES the session worktree and its checkpoints');
      const r = discardSessionWorktree(cwd, id);
      return r.ok ? (log(`✓ discarded worktree ${id}`), 0) : fail(r.reason ?? 'cannot discard');
    }
    case 'list':
    case undefined:
      log(toon('worktrees', listSessionWorktrees(cwd).map((w) => ({ id: (w.branch ?? '').slice('zz/session-'.length), branch: w.branch ?? '', dir: w.path ?? '' })), ['id', 'branch', 'dir']));
      return 0;
    default:
      return fail(`unknown: zz session worktree ${op}`);
  }
}

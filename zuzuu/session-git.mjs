// zuzuu/session-git.mjs — invisible session-git: one agent session = one branch.
//
//   OPEN  → create `zz/session-<shortid>` (a branch, never a worktree)
//   TURN  → checkpoint commit ON the session branch
//   END   → squash-merge to main as ONE commit `session: <title>`, delete branch
//
// THE most safety-critical module in the codebase: it runs git mutations inside
// USERS' repos, triggered from fail-open lifecycle hooks. Therefore:
//   - every exported op is try-wrapped and returns { ok:false, reason } — NEVER throws
//   - all git goes through spawnSync('git', [args], {cwd}) — no shell strings
//   - non-repo / bare / detached HEAD / merge-rebase-in-progress / unborn HEAD → no-op
//   - never push, never touch remotes, never auto-resolve conflicts (conflict →
//     abort the squash, restore the branch, leave the repo exactly as before)
//   - single-working-branch invariant: at most ONE `zz/session-*` branch; a
//     leftover (crashed session) BLOCKS new session branches until continued,
//     merged, or discarded — the next-session prompt is the recovery path.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';

const PREFIX = 'zz/session-';

/** One git call — argv array only (no shell), never throws. */
function git(args, cwd, input) {
  try {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', input });
    return { ok: r.status === 0 && !r.error, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
  } catch (e) {
    return { ok: false, out: '', err: String(e) };
  }
}

function gitDir(cwd) {
  const r = git(['rev-parse', '--git-dir'], cwd);
  if (!r.ok || !r.out) return null;
  return isAbsolute(r.out) ? r.out : resolve(cwd, r.out);
}

/** Current branch name, or null when detached / not a repo. */
function currentBranch(cwd) {
  const r = git(['symbolic-ref', '--short', '-q', 'HEAD'], cwd);
  return r.ok && r.out ? r.out : null;
}

const branchExists = (cwd, name) => git(['rev-parse', '-q', '--verify', `refs/heads/${name}`], cwd).ok;
const isDirty = (cwd) => !!git(['status', '--porcelain'], cwd).out;

/** Why git mutations are unsafe right now, or null when clear. */
function unsafeReason(cwd) {
  const inside = git(['rev-parse', '--is-inside-work-tree'], cwd);
  if (!inside.ok || inside.out !== 'true') return 'not-a-git-repo';
  if (!git(['rev-parse', '-q', '--verify', 'HEAD'], cwd).ok) return 'no-commits';
  if (!currentBranch(cwd)) return 'detached-head';
  const gd = gitDir(cwd);
  if (gd) {
    // An in-progress merge/rebase/cherry-pick/bisect belongs to the USER — a
    // checkpoint commit here would conclude their operation. Hands off.
    for (const f of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'rebase-merge', 'rebase-apply']) {
      if (existsSync(join(gd, f))) return 'operation-in-progress';
    }
  }
  return null;
}

/** Project opt-out: `.zuzuu/agent.json` carrying `"sessionGit": false`. */
function optedOut(cwd) {
  try {
    const root = git(['rev-parse', '--show-toplevel'], cwd);
    if (!root.ok || !root.out) return false;
    const f = join(root.out, '.zuzuu', 'agent.json');
    if (!existsSync(f)) return false;
    return JSON.parse(readFileSync(f, 'utf8')).sessionGit === false;
  } catch {
    return false; // an unreadable manifest never *enables* danger — but opt-out is explicit
  }
}

function disabledReason(cwd) {
  const r = unsafeReason(cwd);
  if (r) return r;
  if (optedOut(cwd)) return 'opted-out';
  return null;
}

/** True when session-git may act here: a usable git repo, not opted out. */
export function sessionGitEnabled(cwd) {
  try {
    return !disabledReason(cwd);
  } catch {
    return false;
  }
}

/** `zz/session-` + first 8 of the id, sanitized to [a-z0-9]. */
export function sessionBranchName(sessionId) {
  const short = String(sessionId ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return PREFIX + (short || 'unknown');
}

/** All `zz/session-*` branches (there should be at most one — the invariant). */
export function listSessionBranches(cwd) {
  try {
    const r = git(['for-each-ref', '--format=%(refname:short)', `refs/heads/${PREFIX}*`], cwd);
    return r.ok && r.out ? r.out.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * The branch sessions merge back into. Preference order:
 *   1. the branch HEAD was on when the session opened (recorded as
 *      `branch.<session>.zz-base` config at open — survives crashes)
 *   2. origin/HEAD's branch, if it exists locally
 *   3. local `main`, then `master`
 *   4. the current branch, if it isn't itself a session branch
 */
export function mainBranch(cwd) {
  try {
    for (const b of listSessionBranches(cwd)) {
      const base = git(['config', `branch.${b}.zz-base`], cwd);
      if (base.ok && base.out && branchExists(cwd, base.out)) return base.out;
    }
    const oh = git(['symbolic-ref', 'refs/remotes/origin/HEAD'], cwd);
    if (oh.ok && oh.out) {
      const name = oh.out.replace('refs/remotes/origin/', '');
      if (branchExists(cwd, name)) return name;
    }
    if (branchExists(cwd, 'main')) return 'main';
    if (branchExists(cwd, 'master')) return 'master';
    const cur = currentBranch(cwd);
    return cur && !cur.startsWith(PREFIX) ? cur : null;
  } catch {
    return null;
  }
}

/** Commits on the session branch beyond main (best-effort; 0 on any trouble). */
function countCheckpoints(cwd, branch) {
  const main = mainBranch(cwd);
  if (!main || main === branch) return 0;
  const r = git(['rev-list', '--count', `${main}..${branch}`], cwd);
  const n = r.ok ? Number.parseInt(r.out, 10) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/**
 * OPEN: create the session branch (dirty tree fine — changes ride along).
 *   already on this session's branch (host restart) → { ok:true, resumed:true }
 *   another session branch exists (leftover)        → { ok:false, blocked:true, existing }
 */
export function openSession(cwd, sessionId) {
  try {
    const reason = disabledReason(cwd);
    if (reason) return { ok: false, reason };
    const target = sessionBranchName(sessionId);
    const cur = currentBranch(cwd);
    if (cur === target) return { ok: true, resumed: true, branch: target };
    const existing = listSessionBranches(cwd);
    if (existing.length) return { ok: false, blocked: true, existing: existing[0] };
    const r = git(['checkout', '-q', '-b', target], cwd);
    if (!r.ok) return { ok: false, reason: r.err || 'checkout-failed' };
    git(['config', `branch.${target}.zz-base`, cur], cwd); // remember where to merge back (best-effort)
    return { ok: true, branch: target };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** TURN: checkpoint commit — only ON a session branch, only when dirty. NEVER commits on main. */
export function checkpoint(cwd) {
  try {
    const blocked = unsafeReason(cwd);
    if (blocked) return { ok: false, reason: blocked };
    const cur = currentBranch(cwd);
    if (!cur || !cur.startsWith(PREFIX)) return { ok: false, reason: 'not-on-session-branch' };
    if (!isDirty(cwd)) return { ok: true, committed: false, n: countCheckpoints(cwd, cur) };
    const n = countCheckpoints(cwd, cur) + 1;
    if (!git(['add', '-A'], cwd).ok) return { ok: false, reason: 'add-failed' };
    const c = git(['commit', '-q', '-m', `zz: checkpoint ${n}`], cwd);
    if (!c.ok) return { ok: false, reason: c.err || 'commit-failed' };
    return { ok: true, committed: true, n };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** The leftover detector: reflects any zz/session-* branch, checked out or not. */
export function sessionStatus(cwd) {
  try {
    const enabled = sessionGitEnabled(cwd);
    const main = mainBranch(cwd);
    const cur = currentBranch(cwd);
    const onSessionBranch = !!cur && cur.startsWith(PREFIX);
    const branches = listSessionBranches(cwd);
    let active = null;
    if (branches.length) {
      const branch = branches[0];
      active = {
        branch,
        checkpoints: countCheckpoints(cwd, branch),
        dirty: cur === branch && isDirty(cwd),
      };
    }
    return { enabled, mainBranch: main, active, onSessionBranch };
  } catch {
    return { enabled: false, mainBranch: null, active: null, onSessionBranch: false };
  }
}

const defaultTitle = (branch) => `${branch} · ${new Date().toISOString().slice(0, 10)}`;

/** Best-effort: drop squash leftovers so they can't leak into the user's next commit. */
function cleanupSquashState(cwd) {
  const gd = gitDir(cwd);
  if (!gd) return;
  for (const f of ['SQUASH_MSG', 'MERGE_MSG']) {
    try {
      rmSync(join(gd, f), { force: true });
    } catch {
      /* best-effort */
    }
  }
}

/**
 * END: squash-merge the session branch into main as ONE commit
 * `session: <title>`, then delete the branch.
 *   conflict     → abort (reset --merge), restore the prior checkout,
 *                  { ok:false, conflict:true, branch } — repo exactly as before
 *   empty squash → no commit, still cleans up the branch ({ mergedAs:null })
 */
export function closeSession(cwd, { title } = {}) {
  try {
    const blocked = unsafeReason(cwd);
    if (blocked) return { ok: false, reason: blocked };
    const branches = listSessionBranches(cwd);
    if (!branches.length) return { ok: false, reason: 'no-session-branch' };
    const branch = branches[0];
    const cur = currentBranch(cwd);
    const main = mainBranch(cwd);
    if (!main || main === branch) return { ok: false, reason: 'no-main-branch' };

    if (cur === branch) {
      const cp = checkpoint(cwd); // fold any uncommitted work into the squash
      if (!cp.ok) return { ok: false, reason: cp.reason };
    } else if (isDirty(cwd)) {
      // Loose changes on another branch are the USER's — never mix them into the squash.
      return { ok: false, reason: 'dirty-worktree' };
    }

    const commits = countCheckpoints(cwd, branch);
    const restore = () => {
      git(['reset', '--merge'], cwd);
      cleanupSquashState(cwd);
      if (cur && cur !== main) git(['checkout', '-q', cur], cwd);
    };

    const co = git(['checkout', '-q', main], cwd);
    if (!co.ok) return { ok: false, reason: co.err || 'checkout-main-failed' };
    const merge = git(['merge', '--squash', branch], cwd);
    if (!merge.ok) {
      restore(); // conflict (or any squash failure): leave the repo exactly as before
      return { ok: false, conflict: true, branch };
    }

    let mergedAs = null;
    const nothingStaged = git(['diff', '--cached', '--quiet'], cwd).ok; // exit 1 = staged changes
    if (nothingStaged) {
      cleanupSquashState(cwd); // a stale SQUASH_MSG would hijack the user's next commit
    } else {
      const c = git(['commit', '-q', '-m', `session: ${title || defaultTitle(branch)}`], cwd);
      if (!c.ok) {
        restore();
        return { ok: false, reason: c.err || 'commit-failed' };
      }
      mergedAs = git(['rev-parse', 'HEAD'], cwd).out || null;
    }

    git(['config', '--unset', `branch.${branch}.zz-base`], cwd); // best-effort
    const del = git(['branch', '-D', branch], cwd);
    if (!del.ok) return { ok: true, mergedAs, commits, warning: 'branch-delete-failed' };
    return { ok: true, mergedAs, commits };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** Recovery: check the leftover session branch back out and keep working. */
export function continueSession(cwd) {
  try {
    const blocked = unsafeReason(cwd);
    if (blocked) return { ok: false, reason: blocked };
    const branches = listSessionBranches(cwd);
    if (!branches.length) return { ok: false, reason: 'no-session-branch' };
    const branch = branches[0];
    if (currentBranch(cwd) === branch) return { ok: true, branch };
    const r = git(['checkout', '-q', branch], cwd);
    return r.ok ? { ok: true, branch } : { ok: false, reason: r.err || 'checkout-failed' };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** Recovery: drop the session branch and its checkpoints. The CALLER gates confirmation. */
export function discardSession(cwd) {
  try {
    const blocked = unsafeReason(cwd);
    if (blocked) return { ok: false, reason: blocked };
    const branches = listSessionBranches(cwd);
    if (!branches.length) return { ok: false, reason: 'no-session-branch' };
    const branch = branches[0];
    const main = mainBranch(cwd);
    if (!main || main === branch) return { ok: false, reason: 'no-main-branch' };
    if (currentBranch(cwd) === branch) {
      const co = git(['checkout', '-q', main], cwd);
      if (!co.ok) return { ok: false, reason: co.err || 'checkout-main-failed' };
    }
    git(['config', '--unset', `branch.${branch}.zz-base`], cwd); // best-effort
    const del = git(['branch', '-D', branch], cwd);
    return del.ok ? { ok: true, branch } : { ok: false, reason: del.err || 'branch-delete-failed' };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

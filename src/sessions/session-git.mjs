// src/sessions/session-git.mjs — invisible session-git: one agent session = one branch.
//
// what: the OPEN/TURN/END lifecycle of a session as a git branch —
//   OPEN  → create `zz/session-<shortid>` (a branch, never a worktree)
//   TURN  → checkpoint commit ON the session branch
//   END   → squash-merge to main as ONE commit `session: <title>`, delete branch
// why:  every turn becomes an undoable checkpoint, and a session lands on main as
//       one clean commit — without the user ever seeing the branch dance.
// how:  THE most safety-critical module in the codebase (git mutations inside
//       USERS' repos, from fail-open hooks); the invariants below are absolute.
//       (Over the ~200-line cap by design: the lifecycle + its single-working-
//       branch recovery is one cohesive responsibility the characterization tests
//       pin as a unit; the git plumbing already lives in git.mjs.)
//
// Therefore:
//   - every exported op is try-wrapped and returns { ok:false, reason } — NEVER throws
//   - all git goes through git.mjs plumbing — spawnSync argv arrays, no shell strings
//   - non-repo / bare / detached HEAD / merge-rebase-in-progress / unborn HEAD → no-op
//   - never push, never touch remotes, never auto-resolve conflicts (conflict →
//     abort the squash, restore the branch, leave the repo exactly as before)
//   - single-working-branch invariant: at most ONE `zz/session-*` branch; a
//     leftover (crashed session) BLOCKS new session branches until continued,
//     merged, or discarded — the next-session prompt is the recovery path.
//   - secrets policy: checkpoints NEVER stage secret material (the same family
//     the seeded no-secret-reads guardrail denies: .env/.env.* at any depth,
//     *.pem, *.key, id_rsa*) — excluded files stay untracked in the worktree
//     and are reported as `excludedSecrets`.
//   - checkpoint history is never destroyed silently: an empty squash that
//     still has checkpoints KEEPS the branch (explicit discard is the only
//     way exploration history is dropped).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, gitDir, currentBranch, branchExists, isDirty, cleanupSquashState } from './git.mjs';

const PREFIX = 'zz/session-';
// Held branches: a finalized session moved OUT of the active `zz/session-*`
// namespace so it can no longer block a new open (openSession/listSessionBranches
// gate only on PREFIX) nor catch the next session's checkpoints — it stays
// discoverable here, awaiting the explicit merge gate.
const HELD_PREFIX = 'zz/held-';

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

/**
 * Project opt-IN: `.zuzuu/agent.json` carrying `"autoMerge": true`. The migration
 * escape hatch — it restores the OLD auto-merge-on-END behavior for users who
 * relied on auto-land. Default false = gated (END holds for review). Mirrors
 * optedOut's read EXACTLY (same file, same parse, fail-soft): an unreadable
 * manifest never enables auto-land — the safe default is the gated hold.
 */
export function autoMergeEnabled(cwd) {
  try {
    const root = git(['rev-parse', '--show-toplevel'], cwd);
    if (!root.ok || !root.out) return false;
    const f = join(root.out, '.zuzuu', 'agent.json');
    if (!existsSync(f)) return false;
    return JSON.parse(readFileSync(f, 'utf8')).autoMerge === true;
  } catch {
    return false; // an unreadable manifest never *enables* auto-land
  }
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

/** All `zz/session-*` branches (there should be at most one — the invariant).
 *  ACTIVE sessions only; held (finalized) branches live in the `zz/held-*`
 *  namespace and are enumerated by listHeldBranches — they do NOT count here,
 *  so a held branch never trips the single-working-branch block. */
export function listSessionBranches(cwd) {
  try {
    const r = git(['for-each-ref', '--format=%(refname:short)', `refs/heads/${PREFIX}*`], cwd);
    return r.ok && r.out ? r.out.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Session branches that would BLOCK a new in-place open here.
 *  A `zz/session-*` branch checked out in a LINKED worktree (a held or active
 *  worktree session under `.zuzuu/worktrees/`) is ISOLATED — it physically can't
 *  collide with this tree's checkout, which is exactly what the single-working-
 *  branch invariant guards against. So it must NOT block a new in-place open.
 *  Keyed on branch identity (not path): a branch is blocking unless it's checked
 *  out in a worktree that is NOT the current tree. Loose leftovers (no worktree)
 *  and this tree's own session branch still block. Fail toward safe (blocking). */
export function blockingSessionBranches(cwd) {
  try {
    const cur = currentBranch(cwd);
    // %(worktreepath) is empty for a branch not checked out anywhere, else the
    // path of the worktree holding it (git ≥ 2.13).
    const r = git(['for-each-ref', '--format=%(refname:short)|%(worktreepath)', `refs/heads/${PREFIX}*`], cwd);
    if (!r.ok || !r.out) return [];
    const blocking = [];
    for (const line of r.out.split('\n').filter(Boolean)) {
      const i = line.indexOf('|');
      const name = i >= 0 ? line.slice(0, i) : line;
      const wt = i >= 0 ? line.slice(i + 1) : '';
      if (wt && name !== cur) continue; // isolated in another (linked) worktree → non-blocking
      blocking.push(name);
    }
    return blocking;
  } catch {
    return listSessionBranches(cwd); // fail toward the safe (blocking) reading
  }
}

/** The held name for an active session branch: `zz/session-<x>` → `zz/held-<x>`. */
export function heldBranchName(sessionBranch) {
  return HELD_PREFIX + String(sessionBranch ?? '').slice(PREFIX.length);
}

/** All `zz/held-*` branches — finalized sessions awaiting the merge gate.
 *  Discoverable (status/digest/the future queue read these) but non-blocking. */
export function listHeldBranches(cwd) {
  try {
    const r = git(['for-each-ref', '--format=%(refname:short)', `refs/heads/${HELD_PREFIX}*`], cwd);
    return r.ok && r.out ? r.out.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** EVERY held session awaiting the merge gate, across BOTH holding models:
 *    · in-place held — renamed into `zz/held-*` (finalizeSession)
 *    · worktree-held — a `zz/session-*` branch checked out in a LINKED worktree
 *      (finalizeSessionWorktree leaves it in place; the worktree isolates it) —
 *      the inverse of blockingSessionBranches, keyed the same way (name !== cur,
 *      so this tree's OWN active session is never counted as held).
 *  This is the union `zz session status` lists and the digest counts — the
 *  merge-gate queue. Fail-soft → []. */
export function heldSessionBranches(cwd) {
  try {
    const cur = currentBranch(cwd);
    const r = git(['for-each-ref', '--format=%(refname:short)|%(worktreepath)', `refs/heads/${PREFIX}*`], cwd);
    const worktreeHeld = [];
    if (r.ok && r.out) {
      for (const line of r.out.split('\n').filter(Boolean)) {
        const i = line.indexOf('|');
        const name = i >= 0 ? line.slice(0, i) : line;
        const wt = i >= 0 ? line.slice(i + 1) : '';
        if (wt && name !== cur) worktreeHeld.push(name); // isolated in a linked worktree → held
      }
    }
    return [...listHeldBranches(cwd), ...worktreeHeld];
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
export function countCheckpoints(cwd, branch) {
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
    // The branch name is a truncated id, so two distinct session ids can collide
    // onto it. Stamp the FULL id on the branch and refuse to resume one that
    // belongs to a different session (else session B silently commits onto A's
    // branch). A branch from before this stamp (no zz-id) resumes as before.
    const recorded = git(['config', `branch.${target}.zz-id`], cwd).out;
    if (recorded && recorded !== String(sessionId)) return { ok: false, blocked: true, collision: true, existing: target, reason: 'id-collision' };
    const cur = currentBranch(cwd);
    if (cur === target) return { ok: true, resumed: true, branch: target };
    // A held/active worktree session keeps its `zz/session-*` branch checked out
    // in its own worktree — isolated, so it must not trip this block (it can't
    // collide with the main tree). Only loose leftovers + this tree's own session
    // branch count.
    const existing = blockingSessionBranches(cwd);
    if (existing.length) return { ok: false, blocked: true, existing: existing[0] };
    const r = git(['checkout', '-q', '-b', target], cwd);
    if (!r.ok) return { ok: false, reason: r.err || 'checkout-failed' };
    git(['config', `branch.${target}.zz-base`, cur], cwd); // remember where to merge back (best-effort)
    git(['config', `branch.${target}.zz-id`, String(sessionId)], cwd); // stamp the full id (collision guard)
    return { ok: true, branch: target };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

// The secret family checkpoints must never commit — mirrors the seeded
// no-secret-reads guardrail (scaffold.mjs RULES_SEED: .env / id_rsa / .pem).
const SECRET_GLOBS = [
  '.env', '.env.*', '**/.env', '**/.env.*',
  '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx', '**/*.crt',
  '**/id_rsa*', '**/id_dsa*', '**/id_ecdsa*', '**/id_ed25519*',
  '**/credentials',
];
const SECRET_RE = /(^|\/)\.env(\.|$)|(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)[^/]*$|\.(pem|key|p12|pfx|crt)$|(^|\/)credentials$/;

/** How many dirty/untracked paths are secret-family (and so were excluded). */
function countExcludedSecrets(cwd) {
  const out = git(['status', '--porcelain', '-uall'], cwd).out; // -uall: expand untracked dirs
  if (!out) return 0;
  let n = 0;
  for (const line of out.split('\n')) {
    // Extract the path tolerantly: the git() wrapper trims the whole stdout, so
    // the FIRST porcelain line can lose its leading space (` M x` → `M x`). The
    // `{1,2}` status match (with space in the class) handles both shapes — a bare
    // slice(3) would shift the path and miss a secret.
    const m = line.match(/^[ ?!MTADRCU]{1,2} (.+)$/);
    const raw = m ? m[1] : line;
    const path = (raw.includes(' -> ') ? raw.split(' -> ').pop() : raw).replace(/^"|"$/g, '');
    if (SECRET_RE.test(path)) n += 1;
  }
  return n;
}

// zuzuu's OWN tracked files churn at runtime (the session index is rewritten on
// every capture). They must NOT count as USER dirt that blocks a session merge,
// and they're safe to reset before the branch dance — `capture`/`doctor`
// regenerate them. (.traces/.live are git-ignored; sessions.json is the tracked one.)
const ZUZUU_OWN_PATH = '.zuzuu/sessions.json';
// Let git itself exclude zuzuu's own files (robust — no porcelain parsing, which
// the trimming git() wrapper would shift off-by-one on a leading-space status).
const EXCLUDE_ZUZUU_OWN = `:(exclude)${ZUZUU_OWN_PATH}`;

/** Worktree has changes the USER cares about — anything beyond zuzuu's own
 *  runtime-managed tracked files. Gates a merge from off the session branch. */
export function userDirty(cwd) {
  return !!git(['status', '--porcelain', '-uall', '--', '.', EXCLUDE_ZUZUU_OWN], cwd).out;
}

/** Reset zuzuu's OWN tracked index churn to HEAD so it can't block a checkout.
 *  Best-effort; only acts when that file is actually dirty. */
function resetZuzuuOwn(cwd) {
  if (git(['status', '--porcelain', '--', ZUZUU_OWN_PATH], cwd).out) {
    git(['checkout', '-q', '--', ZUZUU_OWN_PATH], cwd);
  }
}

/** TURN: checkpoint commit — only ON a session branch, only when dirty. NEVER commits on main.
 *  Secret-family files are excluded from staging (left untracked/unstaged);
 *  the count of excluded paths is returned as `excludedSecrets` when > 0. */
export function checkpoint(cwd) {
  try {
    const blocked = unsafeReason(cwd);
    if (blocked) return { ok: false, reason: blocked };
    const cur = currentBranch(cwd);
    if (!cur || !cur.startsWith(PREFIX)) return { ok: false, reason: 'not-on-session-branch' };
    const base = countCheckpoints(cwd, cur);
    if (!isDirty(cwd)) return { ok: true, committed: false, n: base };
    const excludedSecrets = countExcludedSecrets(cwd);
    const add = git(['add', '-A', '--', '.', ...SECRET_GLOBS.map((g) => `:(exclude,glob)${g}`)], cwd);
    if (!add.ok) return { ok: false, reason: 'add-failed' };
    if (git(['diff', '--cached', '--quiet'], cwd).ok) {
      // everything dirty was secret material — never an empty commit
      return { ok: true, committed: false, n: base, ...(excludedSecrets ? { excludedSecrets } : {}) };
    }
    const c = git(['commit', '-q', '-m', `zz: checkpoint ${base + 1}`], cwd);
    if (!c.ok) return { ok: false, reason: c.err || 'commit-failed' };
    return { ok: true, committed: true, n: base + 1, ...(excludedSecrets ? { excludedSecrets } : {}) };
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
      const checkpoints = countCheckpoints(cwd, branch);
      active = {
        branch,
        checkpoints,
        dirty: cur === branch && isDirty(cwd),
        // exploration-only session: checkpoints exist but the tree equals main
        // (the empty-squash-with-checkpoints case doctor/status render specially)
        noNetChanges: checkpoints > 0 && !!main && main !== branch && git(['diff', '--quiet', main, branch], cwd).ok,
      };
    }
    return { enabled, mainBranch: main, active, onSessionBranch };
  } catch {
    return { enabled: false, mainBranch: null, active: null, onSessionBranch: false };
  }
}

export const defaultTitle = (branch) => `${branch} · ${new Date().toISOString().slice(0, 10)}`;

/** True when this git supports `merge-tree --write-tree` (git ≥ 2.38) — the only
 *  PURE-READ mergeability probe (writes loose objects, never the index/worktree).
 *  Below 2.38 there is NO non-mutating probe, so mergeability degrades to
 *  'unknown' — we NEVER fall back to a `merge --squash` probe (it stages/conflicts
 *  in the real index, and a mid-probe crash would corrupt the user's tree). */
function supportsMergeTreeWriteTree(cwd) {
  const m = git(['--version'], cwd).out.match(/(\d+)\.(\d+)/);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return major > 2 || (major === 2 && minor >= 38);
}

/**
 * Would the held branch squash-merge cleanly onto current `main`?
 *   'ready'    → clean (exit 0)
 *   'conflict' → merge conflict (exit 1) — mirrors what `git merge --squash`
 *                (closeSession's actual merge) would hit
 *   'unknown'  → can't probe (git < 2.38, or a probe error: bad refs, fatal)
 *
 * The probe is `git merge-tree --write-tree --quiet <main> <branch>` — NO
 * --merge-base (git auto-computes the merge-base, exactly as a real merge does;
 * the recorded zz-base is a branch NAME and would resolve to main's *current*
 * tip once main advances, giving the wrong merge-base). It writes only loose
 * objects; the index + working tree are byte-identical before/after, including
 * on conflict (characterization-pinned).
 */
function probeMergeability(cwd, main, branch) {
  if (!main || main === branch) return 'unknown';
  if (!supportsMergeTreeWriteTree(cwd)) return 'unknown';
  const r = git(['merge-tree', '--write-tree', '--quiet', main, branch], cwd);
  if (r.code === 0) return 'ready';
  if (r.code === 1) return 'conflict';
  return 'unknown'; // 128/129/… (fatal/usage/unrelated histories) → never a false conflict
}

/**
 * REVIEW (pure read — NEVER mutates the repo): the data the merge gate needs to
 * decide on a held branch (`zz/held-*`) or a worktree-held session branch
 * (`zz/session-*`). Returns the diff summary vs the branch's base, the checkpoint
 * count, the default squash title, and mergeability vs CURRENT `main` (computed
 * at read time, never cached).
 *
 *   { ok:true, branch, base, title, checkpoints, files, added, removed, mergeability }
 *   { ok:false, reason }   — fail-soft (preconditions / missing branch / no base)
 *
 * Pure-read guarantees: the diff (`--numstat`, three-dot) and the merge-tree
 * probe touch neither the index nor the working tree. No checkout, no merge, no
 * commit — closeSession owns every mutation.
 */
export function sessionReview(cwd, branch) {
  try {
    const blocked = unsafeReason(cwd);
    if (blocked) return { ok: false, reason: blocked };
    if (!branch || !branchExists(cwd, branch)) return { ok: false, reason: 'no-such-branch' };

    // base: the recorded divergence branch, else the resolved main.
    const baseCfg = git(['config', `branch.${branch}.zz-base`], cwd).out;
    const base = baseCfg && branchExists(cwd, baseCfg) ? baseCfg : mainBranch(cwd);
    if (!base) return { ok: false, reason: 'no-base' };

    // diff summary: the branch's own changes vs its base (three-dot = merge-base
    // diff, so it's right even if main advanced). Pure read.
    let files = 0;
    let added = 0;
    let removed = 0;
    const numstat = git(['diff', '--numstat', `${base}...${branch}`], cwd);
    if (numstat.ok && numstat.out) {
      for (const line of numstat.out.split('\n').filter(Boolean)) {
        const cols = line.split('\t');
        if (cols.length < 3) continue;
        files += 1;
        if (cols[0] !== '-') added += Number.parseInt(cols[0], 10) || 0; // '-' = binary
        if (cols[1] !== '-') removed += Number.parseInt(cols[1], 10) || 0;
      }
    }

    const checkpoints = countCheckpoints(cwd, branch);
    const title = defaultTitle(branch);
    const mergeability = probeMergeability(cwd, mainBranch(cwd), branch);

    return { ok: true, branch, base, title, checkpoints, files, added, removed, mergeability };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/**
 * END: squash-merge the session branch into main as ONE commit
 * `session: <title>`, then delete the branch. Every ok:true return carries
 * `mergedTo` (the branch actually merged into); when the recorded zz-base
 * branch no longer exists, `warning:'base-branch-missing'` flags the fallback.
 *   conflict        → abort (reset --merge), restore the prior checkout,
 *                     { ok:false, conflict:true, branch, restoredTo } —
 *                     restoredTo:null means the checkout back failed (stranded on main)
 *   empty squash    → 0 checkpoints: no commit, still cleans up ({ mergedAs:null });
 *                     WITH checkpoints: the branch is KEPT (history is never
 *                     destroyed silently) → { ok:false,
 *                     reason:'empty-squash-with-checkpoints', commits, branch }
 */
export function closeSession(cwd, { title } = {}) {
  try {
    const blocked = unsafeReason(cwd);
    if (blocked) return { ok: false, reason: blocked };
    const branches = listSessionBranches(cwd);
    if (!branches.length) return { ok: false, reason: 'no-session-branch' };
    const branch = branches[0];
    const cur = currentBranch(cwd);
    const baseCfg = git(['config', `branch.${branch}.zz-base`], cwd).out;
    const main = mainBranch(cwd);
    if (!main || main === branch) return { ok: false, reason: 'no-main-branch' };
    // honesty: the branch we recorded at open is gone → we merge to a fallback
    const baseMissing = !!baseCfg && !branchExists(cwd, baseCfg);

    let excludedSecrets = 0;
    if (cur === branch) {
      const cp = checkpoint(cwd); // fold any uncommitted work into the squash
      if (!cp.ok) return { ok: false, reason: cp.reason };
      excludedSecrets = cp.excludedSecrets ?? 0;
    } else if (userDirty(cwd)) {
      // Loose changes on another branch are the USER's — never mix them into the
      // squash. zuzuu's OWN index churn (.zuzuu/sessions.json) is excused below.
      return { ok: false, reason: 'dirty-worktree' };
    }

    const commits = countCheckpoints(cwd, branch);
    /** Undo a failed merge and put the user back where they were. Returns the
     *  branch we actually landed on — null = the checkout back failed and the
     *  user is STRANDED ON MAIN (report it, never pretend otherwise). */
    const restore = () => {
      git(['reset', '--merge'], cwd);
      cleanupSquashState(cwd);
      if (!cur || cur === main) return cur ?? null;
      return git(['checkout', '-q', cur], cwd).ok ? cur : null;
    };

    // zuzuu's own index churn (excused by userDirty above) would still block the
    // checkout to main — reset it first; capture/doctor regenerate it.
    resetZuzuuOwn(cwd);
    const co = git(['checkout', '-q', main], cwd);
    if (!co.ok) return { ok: false, reason: co.err || 'checkout-main-failed' };
    const merge = git(['merge', '--squash', branch], cwd);
    if (!merge.ok) {
      // conflict (or any squash failure): leave the repo exactly as before
      return { ok: false, conflict: true, branch, restoredTo: restore() };
    }

    const extras = {
      ...(excludedSecrets ? { excludedSecrets } : {}),
      ...(baseMissing ? { warning: 'base-branch-missing' } : {}),
    };

    let mergedAs = null;
    const nothingStaged = git(['diff', '--cached', '--quiet'], cwd).ok; // exit 1 = staged changes
    if (nothingStaged) {
      cleanupSquashState(cwd); // a stale SQUASH_MSG would hijack the user's next commit
      if (commits > 0) {
        // Exploration-only session: the squash is empty but real checkpoints
        // exist. NEVER delete that history silently — keep the branch, put the
        // user back, and report; `zuzuu session discard --yes` is the drop path.
        if (cur && cur !== main) git(['checkout', '-q', cur], cwd);
        return { ok: false, reason: 'empty-squash-with-checkpoints', commits, branch, ...extras };
      }
    } else {
      const c = git(['commit', '-q', '-m', `session: ${title || defaultTitle(branch)}`], cwd);
      if (!c.ok) {
        return { ok: false, reason: c.err || 'commit-failed', restoredTo: restore() };
      }
      mergedAs = git(['rev-parse', 'HEAD'], cwd).out || null;
    }

    git(['config', '--unset', `branch.${branch}.zz-base`], cwd); // best-effort
    const del = git(['branch', '-D', branch], cwd);
    if (!del.ok) {
      const warning = extras.warning ? `${extras.warning},branch-delete-failed` : 'branch-delete-failed';
      return { ok: true, mergedAs, mergedTo: main, commits, ...extras, warning };
    }
    return { ok: true, mergedAs, mergedTo: main, commits, ...extras };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/**
 * FINALIZE (hold, never merge): fold any uncommitted work into a final
 * checkpoint, then move the session branch OUT of the active namespace so it
 * can't block or contaminate the next session — `main` is left untouched.
 *
 * The mechanism (the in-place safety the merge gate relies on):
 *   1. checkpoint() folds dirty work onto the session branch (no-op when clean)
 *   2. `git branch -m zz/session-<x> zz/held-<x>` — out of the `zz/session-*`
 *      namespace that openSession/listSessionBranches gate on (so it can't block
 *      a new open). The zz-base/zz-id config rides along (git moves the section;
 *      re-set defensively so the held branch always knows its merge base).
 *   3. checkout the base branch — the working tree leaves the session branch, so
 *      the NEXT session's checkpoints land on its own branch, never the held one.
 *
 * Fail-soft, never merges: returns { ok:true, held, base, checkpoints } or
 * { ok:false, reason }. The unsafeReason preconditions (not-a-repo / no-commits /
 * detached-head / operation-in-progress) are a clean no-op, same as closeSession.
 * The explicit merge stays in closeSession — this only HOLDS.
 */
export function finalizeSession(cwd) {
  try {
    const blocked = unsafeReason(cwd);
    if (blocked) return { ok: false, reason: blocked };
    const branches = listSessionBranches(cwd);
    if (!branches.length) return { ok: false, reason: 'no-session-branch' };
    const branch = branches[0];
    const held = heldBranchName(branch);
    if (branchExists(cwd, held)) return { ok: false, reason: 'held-branch-exists' };

    // Capture base + config BEFORE the rename: mainBranch resolves the recorded
    // zz-base by iterating the ACTIVE namespace, which the rename empties.
    const baseCfg = git(['config', `branch.${branch}.zz-base`], cwd).out;
    const idCfg = git(['config', `branch.${branch}.zz-id`], cwd).out;
    const base = baseCfg && branchExists(cwd, baseCfg) ? baseCfg : mainBranch(cwd);
    if (!base || base === branch) return { ok: false, reason: 'no-main-branch' };

    const cur = currentBranch(cwd);
    let checkpoints = countCheckpoints(cwd, branch);
    let excludedSecrets = 0;
    if (cur === branch) {
      const cp = checkpoint(cwd); // fold any uncommitted work (no-op when clean)
      if (!cp.ok) return { ok: false, reason: cp.reason };
      checkpoints = cp.n ?? checkpoints;
      excludedSecrets = cp.excludedSecrets ?? 0;
    } else if (userDirty(cwd)) {
      // loose changes on another branch belong to the USER — never fold them in
      return { ok: false, reason: 'dirty-worktree' };
    }

    const mv = git(['branch', '-m', branch, held], cwd);
    if (!mv.ok) return { ok: false, reason: mv.err || 'rename-failed' };
    if (baseCfg) git(['config', `branch.${held}.zz-base`, baseCfg], cwd); // defensive — keep the merge base
    if (idCfg) git(['config', `branch.${held}.zz-id`, idCfg], cwd);

    resetZuzuuOwn(cwd); // zuzuu's own index churn must not block the checkout
    const co = git(['checkout', '-q', base], cwd);
    if (!co.ok) return { ok: false, reason: co.err || 'checkout-base-failed', held, base, checkpoints };

    return { ok: true, held, base, checkpoints, ...(excludedSecrets ? { excludedSecrets } : {}) };
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
    resetZuzuuOwn(cwd); // zuzuu's own index churn must not block the checkout
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
      resetZuzuuOwn(cwd); // zuzuu's own index churn must not block the checkout
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

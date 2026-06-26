// src/server/agent-close.ts — one job: the agent-exit squash-merge orchestration.
//
// When an agent PTY exits, its invisible session branch is squash-merged back via
// the zz CLI. Worktree-backed agents (Wave B) merge via `session worktree close`
// run from the MAIN tree; in-place agents use `session merge` from their own cwd.
// Closes are SERIALIZED so two agents exiting at once don't race on the shared main
// working tree. CLI-only, like every zuzuu mutation; absent CLI is recorded, never
// fatal. The Session's close hook guarantees this runs once per session.

import type { SessionCloseResult, SessionMergeResult } from "#shared/index.js";
import type { Session } from "./session.js";
import { runZuzuuMut, type ZuzuuMutResult } from "./zuzuu-cli.js";
import { readProjectHealth } from "./project-health.js";

/** Map a CLI mutation result onto the SessionCloseResult envelope. The post-close
 *  pending count (U5) rides only on the success arm — it's only meaningful once a
 *  merge ran AND the close-time `zz observe` staged this session's proposals. */
function mapCloseResult(r: ZuzuuMutResult, pending?: number): SessionCloseResult {
  if (r.ok) return { ok: true, merge: r.data as SessionMergeResult, ...(pending !== undefined ? { pending } : {}) };
  if (r.code === "absent") return { cliAbsent: true };
  return { ok: false, ...(r.stderr !== undefined ? { stderr: r.stderr } : {}), ...(r.data !== undefined ? { refusal: r.data as Record<string, unknown> } : {}) };
}

export interface AgentCloser {
  /** agent PTY exited → squash-merge its branch back (serialized on the main tree) */
  close: (session: Session) => Promise<SessionCloseResult>;
}

/** Test seam: how the closer reads the post-close pending count. Defaults to the
 *  on-disk `.zuzuu` stat (no CLI spawn) so server tests inject a stub count. */
export interface AgentCloserDeps {
  binary?: string;
  /** read the staged-proposal count at a workspace root (default: readProjectHealth). */
  pendingCount?: (root: string) => number;
}

/**
 * Build the agent-exit closer bound to a live root getter (switchTo() replaces the
 * root) and an optional zz binary override. Serializes worktree closes internally.
 *
 * U5/KTD5 — deterministic staging: after a SUCCESSFUL merge we run `zz observe`
 * (observe runs only on the host SessionEnd hook / the CLI verb — NOT on the daemon
 * close path), so this just-finished session's proposals are staged on the MAIN
 * tree's `.zuzuu` BEFORE the close card reads `pending`. Then we read the post-close
 * pending count from disk and ride it on the close result (the existing
 * `closeResult` poll surfaces it). Observe failures are swallowed — a degraded
 * mine must never poison the merge result the user already earned.
 */
export function createAgentCloser(getRoot: () => string, deps: AgentCloserDeps = {}): AgentCloser {
  const binary = deps.binary;
  const pendingCount = deps.pendingCount ?? ((root: string) => readProjectHealth(root).pending);
  // serializes worktree squash-merges so two agents exiting at once don't race
  // on the shared main working tree (Wave B concurrency)
  let worktreeCloses: Promise<unknown> = Promise.resolve();

  /** After a successful merge: stage this session's proposals (deterministic) on the
   *  MAIN tree, then count them. The `.zuzuu` home is the git-citizen home at the
   *  toplevel, so the main tree's root is correct for worktree AND in-place agents
   *  (the merge already folded the branch's work onto it). */
  const observeThenCount = async (mut: ZuzuuMutResult): Promise<SessionCloseResult> => {
    if (!mut.ok) return mapCloseResult(mut);
    const root = getRoot();
    // observe is best-effort: a mine failure (absent CLI, parse error) leaves the
    // pending count at whatever was already staged — never blocks the close.
    await runZuzuuMut(root, ["observe"], { binary }).catch(() => undefined);
    let pending: number;
    try { pending = pendingCount(root); } catch { pending = 0; }
    return mapCloseResult(mut, pending);
  };

  const close = async (session: Session): Promise<SessionCloseResult> => {
    // Worktree-backed agents (Wave B): squash-merge via `session worktree close`
    // run from the MAIN tree (getRoot()) — the merge checks out the base + folds
    // the branch there, then removes the worktree. In-place agents keep the
    // original `session merge` from their own cwd.
    if (session.usesWorktree) {
      const run = worktreeCloses.then(() =>
        runZuzuuMut(getRoot(), ["session", "worktree", "close", session.id], { binary }),
      );
      worktreeCloses = run.catch(() => undefined); // never let one failure poison the chain
      return observeThenCount(await run);
    }
    return observeThenCount(
      await runZuzuuMut(session.cwd, ["session", "merge"], { binary }),
    );
  };

  return { close };
}

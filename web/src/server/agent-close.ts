// src/server/agent-close.ts — one job: the agent-exit FINALIZE (hold) orchestration.
//
// U3: when an agent PTY exits, its invisible session branch is FINALIZED (held),
// NEVER auto-merged. The daemon shells `zz session worktree finalize <id>` (folds
// uncommitted work, leaves the worktree + branch held); the squash-merge moves
// behind the explicit `zz session merge` / `worktree close` gate (U6). Finalize
// touches only the session's own worktree — never the main tree — so the old
// main-tree serialization is unnecessary here (it moves to the future merge action,
// KTD6). CLI-only, like every zuzuu mutation; absent CLI is recorded, never fatal.
// The Session's close hook guarantees this runs once per session.

import type { SessionCloseResult } from "#shared/index.js";
import type { Session } from "./session.js";
import { runZuzuuMut, type ZuzuuMutResult } from "./zuzuu-cli.js";
import { readProjectHealth } from "./project-health.js";

/** Map a finalize CLI result onto the SessionCloseResult envelope. The post-close
 *  pending count (U5) rides only on the success arm — it's only meaningful once the
 *  hold ran AND the close-time `zz observe` staged this session's proposals. */
function mapCloseResult(r: ZuzuuMutResult, pending?: number): SessionCloseResult {
  if (r.ok) {
    const d = (r.data ?? {}) as { held?: unknown };
    const branch = typeof d.held === "string" ? d.held : "";
    return { ok: true, held: true, branch, ...(pending !== undefined ? { pending } : {}) };
  }
  if (r.code === "absent") return { cliAbsent: true };
  return { ok: false, ...(r.stderr !== undefined ? { stderr: r.stderr } : {}), ...(r.data !== undefined ? { refusal: r.data as Record<string, unknown> } : {}) };
}

export interface AgentCloser {
  /** agent PTY exited → finalize (hold) its branch; never auto-merges */
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

  /** After a successful hold: stage this session's proposals (deterministic) on the
   *  MAIN tree, then count them. observe mines the just-finished session's transcript
   *  into proposals regardless of whether the work merged — so it's meaningful after
   *  a hold too. The `.zuzuu` home is the git-citizen home at the toplevel, so the
   *  main tree's root is correct for worktree AND in-place agents. */
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
    // U3: FINALIZE (hold), never merge. `zz session worktree finalize <id>` folds the
    // worktree's uncommitted work and leaves the worktree + branch held. It runs from
    // the MAIN tree (getRoot()); it never touches the main tree's checkout, so two
    // agents exiting at once can't race (no serialization needed — that moves to the
    // explicit merge action, KTD6). The squash-merge is now an explicit human gate.
    return observeThenCount(
      await runZuzuuMut(getRoot(), ["session", "worktree", "finalize", session.id], { binary }),
    );
  };

  return { close };
}

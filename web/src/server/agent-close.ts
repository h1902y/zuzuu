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

/** Map a CLI mutation result onto the SessionCloseResult envelope. */
function mapCloseResult(r: ZuzuuMutResult): SessionCloseResult {
  if (r.ok) return { ok: true, merge: r.data as SessionMergeResult };
  if (r.code === "absent") return { cliAbsent: true };
  return { ok: false, ...(r.stderr !== undefined ? { stderr: r.stderr } : {}), ...(r.data !== undefined ? { refusal: r.data as Record<string, unknown> } : {}) };
}

export interface AgentCloser {
  /** agent PTY exited → squash-merge its branch back (serialized on the main tree) */
  close: (session: Session) => Promise<SessionCloseResult>;
}

/**
 * Build the agent-exit closer bound to a live root getter (switchTo() replaces the
 * root) and an optional zz binary override. Serializes worktree closes internally.
 */
export function createAgentCloser(getRoot: () => string, binary?: string): AgentCloser {
  // serializes worktree squash-merges so two agents exiting at once don't race
  // on the shared main working tree (Wave B concurrency)
  let worktreeCloses: Promise<unknown> = Promise.resolve();

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
      return mapCloseResult(await run);
    }
    return mapCloseResult(
      await runZuzuuMut(session.cwd, ["session", "merge"], { binary }),
    );
  };

  return { close };
}

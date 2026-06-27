// src/server/agent-close.ts — one job: the agent-exit END orchestration.
//
// U3/U7: when an agent PTY exits, its invisible session branch is FINALIZED (held)
// by DEFAULT, NEVER auto-merged — the daemon shells `zz session worktree finalize
// <id>` (folds uncommitted work, leaves the worktree + branch held); the squash-merge
// moves behind the explicit `zz session merge` / `worktree close` gate (U6). Finalize
// touches only the session's own worktree — never the main tree — so no serialization
// is needed on that path.
//
// U7 — the migration escape hatch: a per-workspace opt-in (`.zuzuu/agent.json`
// `"autoMerge": true`, mirroring the CLI's `sessionGit:false` opt-out) restores the
// OLD auto-merge-on-exit. That path shells `zz session worktree close` (squash-merge
// → main, remove the worktree), which DOES touch the shared main tree, so it is
// re-SERIALIZED (KTD6) — two agents exiting at once can't race on it.
//
// CLI-only, like every zuzuu mutation; absent CLI is recorded, never fatal. The
// Session's close hook guarantees this runs once per session.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { SessionCloseResult, SessionMergeResult } from "#shared/index.js";
import type { Session } from "./session.js";
import { runZuzuuMut, type ZuzuuMutResult } from "./zuzuu-cli.js";
import { readProjectHealth } from "./project-health.js";
import { createMainTreeLock, type MainTreeLock } from "./main-tree-lock.js";

/** Map a finalize/merge CLI result onto the SessionCloseResult envelope. `merged`
 *  selects the arm: the held variant (default — END holds) vs the merge variant (the
 *  autoMerge escape hatch landed it). The post-close pending count (U5) rides only on
 *  the success arm — it's only meaningful once the close ran AND the close-time `zz
 *  observe` staged this session's proposals. */
function mapCloseResult(r: ZuzuuMutResult, pending?: number, merged = false): SessionCloseResult {
  if (r.ok) {
    if (merged) {
      return { ok: true, merge: (r.data ?? {}) as SessionMergeResult, ...(pending !== undefined ? { pending } : {}) };
    }
    const d = (r.data ?? {}) as { held?: unknown };
    const branch = typeof d.held === "string" ? d.held : "";
    return { ok: true, held: true, branch, ...(pending !== undefined ? { pending } : {}) };
  }
  if (r.code === "absent") return { cliAbsent: true };
  return { ok: false, ...(r.stderr !== undefined ? { stderr: r.stderr } : {}), ...(r.data !== undefined ? { refusal: r.data as Record<string, unknown> } : {}) };
}

export interface AgentCloser {
  /** agent PTY exited → finalize (hold) its branch by default; auto-merge only when
   *  the workspace opted in via agent.json autoMerge:true (the migration escape hatch) */
  close: (session: Session) => Promise<SessionCloseResult>;
}

/** Test seam: how the closer reads the post-close pending count and the auto-merge
 *  opt-in. Defaults read on-disk (no CLI spawn) so server tests inject stubs. */
export interface AgentCloserDeps {
  binary?: string;
  /** read the staged-proposal count at a workspace root (default: readProjectHealth). */
  pendingCount?: (root: string) => number;
  /** read whether this workspace opted INTO auto-merge-on-exit (`.zuzuu/agent.json`
   *  `autoMerge:true`). Default: read it off disk at the root. The escape hatch that
   *  restores the OLD merge-on-END behavior; default false = the gated hold. */
  autoMerge?: (root: string) => boolean;
  /** the shared main-tree serializer (KTD6). The daemon passes ONE instance to both
   *  this closer and the explicit held-merge route so the two main-tree writers can't
   *  race. Default: a private lock (server tests that don't share one still serialize
   *  their own auto-merges). */
  lock?: MainTreeLock;
}

/** Default auto-merge read: `<root>/.zuzuu/agent.json` `"autoMerge": true`. Mirrors
 *  the CLI's `autoMergeEnabled` (same file, same parse, fail-soft) — an unreadable
 *  manifest never enables auto-land; the safe default is the gated hold. */
function readAutoMerge(root: string): boolean {
  try {
    const raw = readFileSync(path.join(root, ".zuzuu", "agent.json"), "utf8");
    return (JSON.parse(raw) as { autoMerge?: unknown }).autoMerge === true;
  } catch {
    return false;
  }
}

/**
 * Build the agent-exit closer bound to a live root getter (switchTo() replaces the
 * root) and an optional zz binary override. Serializes the auto-merge worktree
 * closes internally (KTD6).
 *
 * U5/KTD5 — deterministic staging: after a SUCCESSFUL close (hold OR merge) we run
 * `zz observe` (observe runs only on the host SessionEnd hook / the CLI verb — NOT on
 * the daemon close path), so this just-finished session's proposals are staged on the
 * MAIN tree's `.zuzuu` BEFORE the close card reads `pending`. Then we read the
 * post-close pending count from disk and ride it on the close result (the existing
 * `closeResult` poll surfaces it). Observe failures are swallowed — a degraded mine
 * must never poison the close result the user already earned.
 */
export function createAgentCloser(getRoot: () => string, deps: AgentCloserDeps = {}): AgentCloser {
  const binary = deps.binary;
  const pendingCount = deps.pendingCount ?? ((root: string) => readProjectHealth(root).pending);
  const autoMerge = deps.autoMerge ?? readAutoMerge;
  // serializes the auto-merge worktree squash-merges so two agents exiting at once
  // can't race on the shared main working tree (KTD6). The default hold path doesn't
  // touch the main tree, so it never enters this chain. The daemon shares ONE lock
  // with the explicit held-merge route so a manual merge can't race the auto-merge.
  const lock = deps.lock ?? createMainTreeLock();

  /** After a successful close: stage this session's proposals (deterministic) on the
   *  MAIN tree, then count them. observe mines the just-finished session's transcript
   *  into proposals regardless of whether the work merged — so it's meaningful after a
   *  hold too. The `.zuzuu` home is the git-citizen home at the toplevel, so the main
   *  tree's root is correct for worktree AND in-place agents. */
  const observeThenCount = async (mut: ZuzuuMutResult, merged = false): Promise<SessionCloseResult> => {
    if (!mut.ok) return mapCloseResult(mut, undefined, merged);
    const root = getRoot();
    // observe is best-effort: a mine failure (absent CLI, parse error) leaves the
    // pending count at whatever was already staged — never blocks the close.
    await runZuzuuMut(root, ["observe"], { binary }).catch(() => undefined);
    let pending: number;
    try { pending = pendingCount(root); } catch { pending = 0; }
    return mapCloseResult(mut, pending, merged);
  };

  const close = async (session: Session): Promise<SessionCloseResult> => {
    const root = getRoot();
    if (autoMerge(root)) {
      // U7 ESCAPE HATCH (agent.json autoMerge:true): restore the OLD auto-merge-on-
      // exit. `zz session worktree close <id>` checks out the base on the MAIN tree,
      // squash-merges the branch, and removes the worktree — it touches the shared
      // main tree, so it is SERIALIZED (KTD6) so two agents exiting at once can't race.
      const closed = await lock.run(() =>
        runZuzuuMut(root, ["session", "worktree", "close", session.id], { binary }),
      );
      return observeThenCount(closed, true);
    }
    // U3 DEFAULT: FINALIZE (hold), never merge. `zz session worktree finalize <id>`
    // folds the worktree's uncommitted work and leaves the worktree + branch held. It
    // runs from the MAIN tree (getRoot()) but never touches the main tree's checkout,
    // so two agents exiting at once can't race (no serialization needed). The squash-
    // merge is now an explicit human gate.
    return observeThenCount(
      await runZuzuuMut(getRoot(), ["session", "worktree", "finalize", session.id], { binary }),
    );
  };

  return { close };
}

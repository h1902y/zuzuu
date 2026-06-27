// src/server/held-sessions.ts — the held-session read + the merge/discard argv.
//
// The CODE gate's data source: shell `zz session status --json` and shape its `held[]`
// into the HeldSession DTO, deriving the session id + kind from the branch namespace
// (`zz/session-<id>` worktree-backed, `zz/held-<id>` in-place). The merge/discard
// argv is computed from the entry's kind so a worktree hold lands via `worktree close`
// and an in-place hold via `session merge`. Pure (parse/shape/argv) + one CLI read —
// shared by the GET /api/zuzuu/held route and the POST merge/discard actions, which
// validate a requested id against THIS list before spawning (never trusting the wire id).

import type { HeldSession } from "#shared/index.js";
import { runZuzuu } from "./zuzuu-cli.js";

const SESSION_PREFIX = "zz/session-";
const HELD_PREFIX = "zz/held-";

/** Derive the session id + kind from a held branch name. Null for an unrecognized
 *  branch (only `zz/session-*` and `zz/held-*` are held). */
export function parseHeldBranch(branch: unknown): { id: string; kind: "worktree" | "inplace" } | null {
  if (typeof branch !== "string") return null;
  if (branch.startsWith(SESSION_PREFIX)) {
    const id = branch.slice(SESSION_PREFIX.length);
    return id ? { id, kind: "worktree" } : null;
  }
  if (branch.startsWith(HELD_PREFIX)) {
    const id = branch.slice(HELD_PREFIX.length);
    return id ? { id, kind: "inplace" } : null;
  }
  return null;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const mergeability = (v: unknown): HeldSession["mergeability"] =>
  v === "ready" || v === "conflict" ? v : "unknown";

/** Shape one raw `held` entry from `zz session status --json` into a HeldSession.
 *  Null when the branch is missing/unparseable (defensive — dropped from the list). */
export function shapeHeld(raw: unknown): HeldSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const parsed = parseHeldBranch(r.branch);
  if (!parsed) return null;
  return {
    id: parsed.id,
    branch: r.branch as string,
    kind: parsed.kind,
    checkpoints: num(r.checkpoints),
    files: num(r.files),
    added: num(r.added),
    removed: num(r.removed),
    mergeability: mergeability(r.mergeability),
  };
}

/** Shell `zz session status --json` and return the workspace's held sessions
 *  (id-enriched). CLI absent / parse failure → [] (the read degrades to "nothing
 *  held," never an error). */
export async function readHeld(root: string, binary?: string): Promise<HeldSession[]> {
  const data = (await runZuzuu(root, ["session", "status"], { binary })) as { held?: unknown } | null;
  if (!data || !Array.isArray(data.held)) return [];
  return data.held.map(shapeHeld).filter((h): h is HeldSession => h !== null);
}

/** The argv that LANDS a held session: a worktree hold squash-merges via `worktree
 *  close <id>` (touches the main tree → serialize); an in-place hold via `session
 *  merge`. */
export function mergeArgs(entry: HeldSession): string[] {
  return entry.kind === "worktree"
    ? ["session", "worktree", "close", entry.id]
    : ["session", "merge"];
}

/** The argv that DROPS a held session — branch + all checkpoints, `--yes`-guarded
 *  (the destructive verb refuses without it). */
export function discardArgs(entry: HeldSession): string[] {
  return entry.kind === "worktree"
    ? ["session", "worktree", "discard", entry.id, "--yes"]
    : ["session", "discard", "--yes"];
}

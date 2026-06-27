// src/server/held-sessions.ts — the held-session read + the merge/discard argv.
//
// The CODE gate's data source: shell `zz session status --json` and shape its `held[]`
// into the HeldSession DTO, deriving the session id + kind from the branch namespace
// (`zz/session-<id>` worktree-backed, `zz/held-<id>` in-place). The merge/discard
// argv is computed from the entry's kind so a worktree hold lands via `worktree close`
// and an in-place hold via `session merge`. Pure (parse/shape/argv) + one CLI read —
// shared by the GET /api/zuzuu/held route and the POST merge/discard actions, which
// validate a requested id against THIS list before spawning (never trusting the wire id).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type { HeldSession } from "#shared/index.js";
import { runZuzuu } from "./zuzuu-cli.js";

const execFileP = promisify(execFile);

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

/** Parse `git worktree list --porcelain` into `{ path, branch }[]` (absolute paths,
 *  branch with `refs/heads/` stripped; a detached worktree has no branch). */
export function parseWorktrees(porcelain: string): { path: string; branch: string }[] {
  const list: { path: string; branch: string }[] = [];
  let cur: { path?: string; branch?: string } = {};
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) cur = { path: line.slice("worktree ".length) };
    else if (line.startsWith("branch ")) cur.branch = line.slice("branch ".length).replace("refs/heads/", "");
    else if (line === "") { if (cur.path) list.push({ path: cur.path, branch: cur.branch ?? "" }); cur = {}; }
  }
  if (cur.path) list.push({ path: cur.path, branch: cur.branch ?? "" });
  return list;
}

/** The WORKSPACE-RELATIVE worktree dir holding `branch`, from a parsed worktree
 *  list — `undefined` when no worktree holds it, or when the dir lies outside root
 *  (then the conflict routes to the CLI instruction, not a daemon shell). Relative
 *  + forward-slashed so it round-trips through the create route's `safeJoin(root, …)`
 *  (a session worktree lives under `<root>/.zuzuu/worktrees/<id>`). */
export function worktreeRelPath(
  branch: string,
  worktrees: { path: string; branch: string }[],
  root: string,
): string | undefined {
  const wt = worktrees.find((w) => w.branch === branch);
  if (!wt) return undefined;
  const rel = path.relative(root, wt.path);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
  return rel.split(path.sep).join("/");
}

/** The repo's worktree list, or [] (non-git workspace / git absent → degrade). */
async function listWorktrees(root: string): Promise<{ path: string; branch: string }[]> {
  try {
    const { stdout } = await execFileP("git", ["-C", root, "worktree", "list", "--porcelain"]);
    return parseWorktrees(stdout);
  } catch {
    return [];
  }
}

/** Shell `zz session status --json` and return the workspace's held sessions
 *  (id-enriched). CLI absent / parse failure → [] (the read degrades to "nothing
 *  held," never an error). Worktree-kind holds are enriched with their (workspace-
 *  relative) worktree path so the conflict→Resolve flow can open a shell there. */
export async function readHeld(root: string, binary?: string): Promise<HeldSession[]> {
  const data = (await runZuzuu(root, ["session", "status"], { binary })) as { held?: unknown } | null;
  if (!data || !Array.isArray(data.held)) return [];
  const shaped = data.held.map(shapeHeld).filter((h): h is HeldSession => h !== null);
  if (!shaped.some((h) => h.kind === "worktree")) return shaped;
  const worktrees = await listWorktrees(root);
  return shaped.map((h) => {
    if (h.kind !== "worktree") return h;
    const rel = worktreeRelPath(h.branch, worktrees, root);
    return rel ? { ...h, worktreePath: rel } : h;
  });
}

/** The id + kind a held branch resolves to — enough to pick the verb, without the
 *  full review payload. */
export type HeldRef = Pick<HeldSession, "id" | "kind">;

/** The held branches in `root`, id + kind only — a CHEAP validation source for the
 *  merge/discard routes (no per-branch diff/mergeability probe like `readHeld`).
 *  `zz/held-*` are always held (in-place); a `zz/session-*` branch is held ONLY when
 *  it carries the `zz-held` marker (a LIVE agent is a `zz/session-*` branch too, but
 *  must NOT be actionable as held). CLI-free — straight `git`. Degrades to []. */
export async function listHeldRefs(root: string): Promise<HeldRef[]> {
  try {
    const { stdout } = await execFileP("git", [
      "-C", root, "for-each-ref", "--format=%(refname:short)",
      `refs/heads/${HELD_PREFIX}*`, `refs/heads/${SESSION_PREFIX}*`,
    ]);
    const refs: HeldRef[] = [];
    for (const name of stdout.split("\n").filter(Boolean)) {
      const parsed = parseHeldBranch(name);
      if (!parsed) continue;
      if (parsed.kind === "inplace") { refs.push(parsed); continue; }
      const marked = await execFileP("git", ["-C", root, "config", `branch.${name}.zz-held`])
        .then((r) => r.stdout.trim() === "true")
        .catch(() => false);
      if (marked) refs.push(parsed);
    }
    return refs;
  } catch {
    return [];
  }
}

/** The argv that LANDS a held session: a worktree hold squash-merges via `worktree
 *  close <id>` (touches the main tree → serialize); an in-place hold via `session
 *  merge <id>` (the id resolves the specific `zz/held-<id>` — several may be queued). */
export function mergeArgs(entry: HeldRef): string[] {
  return entry.kind === "worktree"
    ? ["session", "worktree", "close", entry.id]
    : ["session", "merge", entry.id];
}

/** The argv that DROPS a held session — branch + all checkpoints, `--yes`-guarded
 *  (the destructive verb refuses without it). */
export function discardArgs(entry: HeldRef): string[] {
  return entry.kind === "worktree"
    ? ["session", "worktree", "discard", entry.id, "--yes"]
    : ["session", "discard", entry.id, "--yes"];
}

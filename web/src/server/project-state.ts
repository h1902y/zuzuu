// src/server/project-state.ts — the home-envelope state machine (R1–R3, observed
// not asserted). The daemon reports the folder's true on-disk condition; the
// client renders it and refetches after each setup action.
//
// The MAPPING is pure (deriveState) + unit-tested; the fact-gathering (git/.zuzuu
// presence, host hooks, module/session counts) lives in gatherProjectState. Host
// detection reads .claude/settings.json for the stable `#zz-hook` signature —
// Claude Code is the one host today.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ProjectState, ProjectStateKind, HostInfo } from "#shared/index.js";
import { runZuzuu } from "./zuzuu-cli.js";

/** The stable tag `zz enable` writes into every hook command (src/cli/enable.mjs). */
const HOOK_SIGNATURE = "#zz-hook";

export interface StateFacts {
  git: boolean;
  zuzuu: boolean;
  hooksEnabled: boolean;
  /** any sign of real use: a content module, a pending proposal, or a session. */
  hasActivity: boolean;
}

/** The pure 5-state map. The instructions floor alone is NOT activity (it ships with
 *  `zz init`), so `steady` needs a content module / proposal / session. */
export function deriveState(f: StateFacts): ProjectStateKind {
  if (!f.git) return "not-a-repo";
  if (!f.zuzuu) return "no-project";
  if (!f.hooksEnabled) return "hooks-off";
  if (!f.hasActivity) return "no-activity";
  return "steady";
}

/** Detect the host + whether zuzuu's hooks are installed (fs-only). */
export function detectHost(root: string): HostInfo {
  const claudeDir = path.join(root, ".claude");
  if (!existsSync(claudeDir)) return { kind: null, enabled: false };
  let enabled = false;
  try { enabled = readFileSync(path.join(claudeDir, "settings.json"), "utf8").includes(HOOK_SIGNATURE); }
  catch { enabled = false; }
  return { kind: "claude", enabled };
}

interface OverviewEntry { key: string; pending?: number }

/** Gather the live ProjectState for `root`: fs facts + the CLI module overview
 *  (best-effort — CLI absent degrades counts to 0, the state still derives from
 *  git/.zuzuu/hooks). `liveSessions` is the daemon's live PTY count — the honest
 *  "has the user started working" signal (zuzuu records sessions as git branches,
 *  not a JSON index, so there is no on-disk session count to read here). */
export async function gatherProjectState(root: string, binary?: string, liveSessions = 0): Promise<ProjectState> {
  const git = existsSync(path.join(root, ".git"));
  const zuzuu = existsSync(path.join(root, ".zuzuu"));
  const host = detectHost(root);

  let modules = 0;
  let pending = 0;
  let contentful = false;
  if (zuzuu) {
    const ov = (await runZuzuu(root, ["module", "overview"], binary ? { binary } : {})) as OverviewEntry[] | null;
    if (Array.isArray(ov)) {
      modules = ov.length;
      pending = ov.reduce((n, e) => n + (e.pending ?? 0), 0);
      contentful = ov.some((e) => e.key !== "instructions" && e.key !== "guardrails"); // a content module materialized beyond the safety floor
    }
  }

  const hasActivity = pending > 0 || liveSessions > 0 || contentful;
  return {
    state: deriveState({ git, zuzuu, hooksEnabled: host.enabled, hasActivity }),
    host,
    counts: { modules, pending, sessions: liveSessions },
  };
}

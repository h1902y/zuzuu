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

/** The pure 5-state map. The guardrails floor alone is NOT activity (it ships with
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

/** Count sessions from the Project's sessions index (best-effort). */
function countSessions(root: string): number {
  try {
    const raw = JSON.parse(readFileSync(path.join(root, ".zuzuu", "sessions.json"), "utf8")) as { sessions?: unknown[] };
    return Array.isArray(raw.sessions) ? raw.sessions.length : 0;
  } catch { return 0; }
}

interface OverviewEntry { key: string; pending?: number }

/** Gather the live ProjectState for `root`: fs facts + the CLI module overview
 *  (best-effort — CLI absent degrades counts to 0, the state still derives from
 *  git/.zuzuu/hooks). */
export async function gatherProjectState(root: string, binary?: string): Promise<ProjectState> {
  const git = existsSync(path.join(root, ".git"));
  const zuzuu = existsSync(path.join(root, ".zuzuu"));
  const host = detectHost(root);

  let modules = 0;
  let pending = 0;
  let contentful = false;
  let sessions = 0;
  if (zuzuu) {
    const ov = (await runZuzuu(root, ["module", "overview"], binary ? { binary } : {})) as OverviewEntry[] | null;
    if (Array.isArray(ov)) {
      modules = ov.length;
      pending = ov.reduce((n, e) => n + (e.pending ?? 0), 0);
      contentful = ov.some((e) => e.key !== "guardrails"); // a content module materialized
    }
    sessions = countSessions(root);
  }

  const hasActivity = pending > 0 || sessions > 0 || contentful;
  return {
    state: deriveState({ git, zuzuu, hooksEnabled: host.enabled, hasActivity }),
    host,
    counts: { modules, pending, sessions },
  };
}

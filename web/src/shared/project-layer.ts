// src/shared/project-layer.ts — the Project-layer contract (onboarding + switching).
//
// The surface ABOVE the in-Project shell: the home-envelope state machine
// (onboarding), the recents picker + open-folder autocomplete (switching). Both
// halves import these via `#shared`. Switching reuses the daemon's existing
// in-place re-root (POST /api/workspace/switch) — there is no per-daemon launcher.
//
//   GET  /api/zuzuu/project-state   → ProjectState   (root-scoped)
//   GET  /api/projects/recents      → RecentsList     (machine-global)
//   GET  /api/projects/dir?prefix=  → DirListing      (machine-global, names-only)

/** The five home-envelope states, observed from the folder's on-disk condition.
 *  not-a-repo → no .git · no-project → git but no .zuzuu/ · hooks-off → .zuzuu/
 *  but host hooks absent · no-activity → enabled, no sessions/modules yet ·
 *  steady → has content/activity (the module-cards home). */
export type ProjectStateKind =
  | "not-a-repo"
  | "no-project"
  | "hooks-off"
  | "no-activity"
  | "steady";

/** Host detection for the Enable rung. `kind` is the detected host (Claude Code
 *  is the only host today) or null when none is present. */
export interface HostInfo {
  kind: string | null;
  enabled: boolean;
}

/** GET /api/zuzuu/project-state — the home-envelope state for the current root. */
export interface ProjectState {
  state: ProjectStateKind;
  host: HostInfo;
  counts: { modules: number; pending: number; sessions: number };
}

/** One row in the switcher popover. `current` marks the daemon's active root. */
export interface RecentProject {
  path: string;
  name: string;
  current: boolean;
}

/** GET /api/projects/recents — recents (most-recent-first), current marked. */
export interface RecentsList {
  recents: RecentProject[];
}

/** One row of the Projects Home — a recent project + its health read from disk
 *  (no daemon running). GET /api/projects/list. */
export interface ProjectSummary {
  path: string;
  name: string;
  current: boolean;
  modules: number;
  notes: number;
  pending: number;
  guarded: boolean;
  /** newest .zuzuu mtime (ms epoch), 0 when unknown. */
  lastActivityMs: number;
}

export interface ProjectsList {
  projects: ProjectSummary[];
}

/** GET /api/projects/dir — names-only directory autocomplete for "Open a folder…".
 *  `dirs` are child directory names under `prefix` (never files, never contents). */
export interface DirListing {
  prefix: string;
  dirs: string[];
}

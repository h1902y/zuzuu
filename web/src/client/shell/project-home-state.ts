// shell/project-home-state.ts — the CLIENT view of the home-envelope state (R1–R3).
// Pure: maps the daemon's ProjectState → the home render mode + the onboarding
// checklist's per-rung status. All branching lives here so the .tsx (U9/U10) stays
// thin. The server owns the *state* (project-state.ts); this owns its *presentation*.

import type { ProjectStateKind } from "#shared/index.js";

/** The onboarding rungs, in order. `git-init` is the not-a-repo precondition;
 *  `review` is the by-doing handoff (it completes once the first proposal is
 *  reviewed — the checklist itself hands off to the ribbon at `steady`). */
export type RungId = "git-init" | "init" | "enable" | "session" | "review";
export const RUNGS: RungId[] = ["git-init", "init", "enable", "session", "review"];

export type RungStatus = "done" | "current" | "upcoming";

/** How far the Project has progressed, as an index into RUNGS. */
const PROGRESS: Record<ProjectStateKind, number> = {
  "not-a-repo": 0,
  "no-project": 1,
  "hooks-off": 2,
  "no-activity": 3,
  steady: 4,
};

/** Onboarding (the checklist) until the Project is steady (the module-cards home). */
export function homeMode(state: ProjectStateKind): "onboarding" | "steady" {
  return state === "steady" ? "steady" : "onboarding";
}

/** The next action the user should take, or "review" once setup is done. */
export function currentRung(state: ProjectStateKind): RungId {
  return RUNGS[PROGRESS[state]]!;
}

/** Per-rung status for the checklist: done < current < upcoming, by progress index. */
export function rungStatus(state: ProjectStateKind, rung: RungId): RungStatus {
  const i = RUNGS.indexOf(rung);
  const p = PROGRESS[state];
  if (i < p) return "done";
  if (i === p) return "current";
  return "upcoming";
}

/** The transient "⚑ Set up this Project" nav node shows until the Project is steady. */
export function shouldShowSetupNode(state: ProjectStateKind): boolean {
  return state !== "steady";
}

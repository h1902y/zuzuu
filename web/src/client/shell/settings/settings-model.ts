// shell/settings/settings-model.ts — the per-project Settings derivations (P3.3). Pure
// label/eligibility helpers over the project-state + host facts; Settings.tsx renders.
import type { HostInfo, ProjectStateKind } from "#shared/index.js";

/** The Agent/Host status line. */
export function hostStatusLabel(host: HostInfo): string {
  if (!host.kind) return "No host detected";
  return host.enabled ? `${host.kind} · enabled` : `${host.kind} · detected, not enabled`;
}

/** Whether the Enable action applies (a host is present but its hooks aren't wired). */
export function canEnable(host: HostInfo): boolean {
  return Boolean(host.kind) && !host.enabled;
}

/** A human label for the Project's home-envelope state. */
export function projectStateLabel(state: ProjectStateKind): string {
  switch (state) {
    case "not-a-repo": return "Not a git repository";
    case "no-project": return "Not initialized";
    case "hooks-off": return "Initialized · hooks off";
    case "no-activity": return "Enabled · no activity yet";
    case "steady": return "Active";
    default: return state;
  }
}

// shell/projects/projects-model.ts — the pure model behind the Projects Home (P1.3).
// The table-with-facets logic: search-filter, sort, group-by, and the relative-time
// label — all pure so the .tsx only renders. Tested as functions (no render needed).
import type { ProjectSummary } from "#shared/index.js";

/** Sort orders the Projects Home offers (the facet bar). */
export type ProjectSort = "recent" | "name" | "pending";

/** Group facets — "none" is the flat table; "guarded" splits enabled vs. not. */
export type ProjectGroup = "none" | "guarded";

/** Case-insensitive substring match over the name + path (the search field). */
export function filterProjects(projects: ProjectSummary[], search: string): ProjectSummary[] {
  const q = search.trim().toLowerCase();
  if (!q) return projects;
  return projects.filter(
    (p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
  );
}

/** A stable copy sorted by the chosen facet (recent = newest activity first). */
export function sortProjects(projects: ProjectSummary[], sort: ProjectSort): ProjectSummary[] {
  const rows = [...projects];
  if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "pending") rows.sort((a, b) => b.pending - a.pending || b.lastActivityMs - a.lastActivityMs);
  else rows.sort((a, b) => b.lastActivityMs - a.lastActivityMs);
  return rows;
}

export interface ProjectGroupView {
  /** A stable key + a human label for the section header. */
  key: string;
  label: string;
  projects: ProjectSummary[];
}

/** Group the (already filtered + sorted) rows into sections. "none" → one untitled
 *  section; "guarded" → "Enabled" (guardrails present) then "Not yet enabled". Empty
 *  sections are dropped so the surface never renders a hollow header. */
export function groupProjects(projects: ProjectSummary[], group: ProjectGroup): ProjectGroupView[] {
  if (group !== "guarded") return projects.length ? [{ key: "all", label: "", projects }] : [];
  const enabled = projects.filter((p) => p.guarded);
  const rest = projects.filter((p) => !p.guarded);
  const views: ProjectGroupView[] = [];
  if (enabled.length) views.push({ key: "enabled", label: "Enabled", projects: enabled });
  if (rest.length) views.push({ key: "rest", label: "Not yet enabled", projects: rest });
  return views;
}

/** The full pipeline: filter → sort → group, in one call for the surface. */
export function projectsView(
  projects: ProjectSummary[],
  opts: { search: string; sort: ProjectSort; group: ProjectGroup },
): ProjectGroupView[] {
  return groupProjects(sortProjects(filterProjects(projects, opts.search), opts.sort), opts.group);
}

/** A compact relative-activity label ("just now", "5m ago", "3h ago", "2d ago"). 0
 *  (unknown mtime) → "—". `nowMs` is injected so the label is pure + testable. */
export function relativeTime(ms: number, nowMs: number): string {
  if (!ms) return "—";
  const delta = Math.max(0, nowMs - ms);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

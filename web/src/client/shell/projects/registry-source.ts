// shell/projects/registry-source.ts — the client logic for registry-backed Projects
// Home (U9). The daemon already chose the source + ladder (U8); here we section
// registry rows by their committed group tags and label the source. Pure → tested;
// ProjectsHome.tsx renders it.
import type { ProjectSummary } from "#shared/index.js";

export interface ProjectSection {
  group: string;
  projects: ProjectSummary[];
}

/** Section projects by their committed group tags. A project in multiple groups
 *  appears under each; ungrouped projects fall under "Ungrouped" (last). Groups are
 *  alphabetical so the layout is stable across machines (the registry is shared). */
export function sectionByGroup(projects: ProjectSummary[]): ProjectSection[] {
  const groups = new Map<string, ProjectSummary[]>();
  const ungrouped: ProjectSummary[] = [];
  for (const p of projects) {
    const gs = p.groups ?? [];
    if (!gs.length) { ungrouped.push(p); continue; }
    for (const g of gs) {
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(p);
    }
  }
  const sections = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, ps]) => ({ group, projects: ps }));
  if (ungrouped.length) sections.push({ group: "Ungrouped", projects: ungrouped });
  return sections;
}

/** True when the durable registry is the source (vs the ephemeral recents fallback). */
export function isRegistrySource(source: "registry" | "recents" | undefined): boolean {
  return source === "registry";
}

/** A short label for the current Projects Home data source. */
export function sourceLabel(source: "registry" | "recents" | undefined): string {
  return source === "registry" ? "your registry" : "recent projects";
}

/** Whether any registry-backed row carries group tags (→ render sectioned, not flat). */
export function hasGroups(projects: ProjectSummary[]): boolean {
  return projects.some((p) => (p.groups?.length ?? 0) > 0);
}

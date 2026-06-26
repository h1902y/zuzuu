// shell/projects/ProjectsHome.tsx — the launcher (L1, the decided launch landing).
// A warm, editorial table of every recent Project with its health read from disk
// (no daemon running): notes · tables · ◷ pending-review · protected · last activity.
// Search + sort + group-by facets; the Bagel Fat One logotype; "New / Open a folder".
// Opening a row hands off to useEnterProject (switchTo → land on the Overview, no
// reload). Thin .tsx — projects-model is the tested logic; static utilities only.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Clock, Shield, Plus, Search, Settings } from "lucide-react";
import { api } from "../../lib/api.js";
import { useEnterProject } from "../session/use-enter-project.js";
import { projectsView, relativeTime, type ProjectSort, type ProjectGroup } from "./projects-model.js";
import { sourceLabel } from "./registry-source.js";
import type { ProjectSummary } from "#shared/index.js";
import { Stack, Inline, Text, Icon, Button, ThemeToggle, Loading, Brand } from "../../ds/index.js";
import { NewProject } from "./NewProject.js";
import { GlobalSettings } from "./GlobalSettings.js";

const SORTS: { key: ProjectSort; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "name", label: "Name" },
  { key: "pending", label: "Review" },
];

export function ProjectsHome() {
  const projects = useQuery({ queryKey: ["projects", "list"], queryFn: api.projects.list });
  const enter = useEnterProject();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProjectSort>("recent");
  const [group, setGroup] = useState<ProjectGroup>("none");
  const [newOpen, setNewOpen] = useState(false);
  const [globalOpen, setGlobalOpen] = useState(false);

  const rows = projects.data?.projects ?? [];
  const sections = projectsView(rows, { search, sort, group });
  const registry = projects.data?.registry ?? null;
  const now = Date.now();

  return (
    <div className="flex h-full flex-col bg-app">
      {/* the brand bar — the logotype gets its big moment here */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-8">
        <Brand variant="lockup" size="md" />
        <Inline gap="md">
          <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>
            <Icon icon={Plus} size={15} /> New project
          </Button>
          <Text as="button" interactive tone="muted" onClick={() => setGlobalOpen(true)} title="Global settings">
            <Icon icon={Settings} size={16} />
          </Text>
          <ThemeToggle />
        </Inline>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto w-full max-w-4xl">
          <Stack gap="xl">
            <Stack gap="md">
              <Inline gap="sm" align="baseline">
                <Text size="2xl" font="display">Projects</Text>
                <Text size="meta" tone="muted">· {sourceLabel(projects.data?.source)}</Text>
              </Inline>
              {registry ? (
                <Text as="button" interactive size="meta" tone="muted" onClick={() => setGlobalOpen(true)}>
                  <Inline gap="xs" align="center">
                    <Icon icon={Database} size={12} />
                    <span>coordinated by the registry · </span>
                    <Text as="span" mono tone="subtle" truncate>{registry.home}</Text>
                    <span> · {registry.projects} projects</span>
                  </Inline>
                </Text>
              ) : (
                <Text size="meta" tone="muted">no master registry — set one up in global settings</Text>
              )}
              <Inline gap="md" justify="between" wrap>
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-ui border border-border bg-surface px-3 py-2">
                  <Icon icon={Search} size={15} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search projects…"
                    className="min-w-0 flex-1 bg-transparent text-ui text-ink-100 outline-none placeholder:text-muted"
                  />
                </label>
                <Inline gap="sm">
                  {SORTS.map((s) => (
                    <Button key={s.key} variant={sort === s.key ? "outline" : "ghost"} size="sm" onClick={() => setSort(s.key)}>
                      {s.label}
                    </Button>
                  ))}
                  <Button variant={group === "guarded" ? "outline" : "ghost"} size="sm" onClick={() => setGroup((g) => (g === "guarded" ? "none" : "guarded"))}>
                    Group
                  </Button>
                </Inline>
              </Inline>
            </Stack>

            {projects.isLoading ? (
              <Loading label="reading your projects…" />
            ) : !rows.length ? (
              <EmptyProjects onNew={() => setNewOpen(true)} />
            ) : (
              <Stack gap="lg">
                {sections.map((section) => (
                  <Stack key={section.key} gap="sm">
                    {section.label && <Text size="meta" tone="subtle" weight="semibold">{section.label.toUpperCase()}</Text>}
                    <Stack gap="xs">
                      {section.projects.map((p) => (
                        <ProjectRow key={p.path} project={p} now={now} onOpen={() => void enter(p.path)} />
                      ))}
                    </Stack>
                  </Stack>
                ))}
                {!sections.length && <Text tone="muted" size="ui">No projects match “{search}”.</Text>}
              </Stack>
            )}
          </Stack>
        </div>
      </div>

      {newOpen && <NewProject onClose={() => setNewOpen(false)} />}
      {globalOpen && <GlobalSettings onClose={() => setGlobalOpen(false)} />}
    </div>
  );
}

function ProjectRow({ project: p, now, onOpen }: { project: ProjectSummary; now: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center justify-between gap-4 rounded-ui border border-transparent bg-surface px-5 py-4 text-left transition-colors hover:border-border hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
    >
      <Inline gap="md" align="center">
        <Icon icon={Database} size={20} />
        <Stack gap="none">
          <Inline gap="sm">
            <Text size="base" weight="medium" truncate>{p.name}</Text>
            {p.current && <Text size="meta" tone="accent">open</Text>}
          </Inline>
          <Text size="meta" tone="muted" truncate>{p.path}</Text>
        </Stack>
      </Inline>
      <Inline gap="lg" align="center">
        <Text size="meta" tone="muted">{p.notes} {p.notes === 1 ? "note" : "notes"}</Text>
        <Text size="meta" tone="muted">{p.modules} {p.modules === 1 ? "table" : "tables"}</Text>
        {p.pending > 0 && (
          <Inline gap="xs"><Icon icon={Clock} size={13} /><Text size="meta" tone="accent">{p.pending}</Text></Inline>
        )}
        {p.guarded && <Icon icon={Shield} size={14} />}
        <Text size="meta" tone="subtle">{relativeTime(p.lastActivityMs, now)}</Text>
      </Inline>
    </button>
  );
}

function EmptyProjects({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid place-items-center rounded-lg border border-border bg-surface px-8 py-20 text-center">
      <Stack gap="md" align="center">
        <Icon icon={Database} size={20} />
        <Text size="lg" font="display">No projects yet</Text>
        <Text size="ui" tone="muted">Open a folder to start. Initialize it, enable your agent, and the brain grows as you work.</Text>
        <Button variant="primary" size="sm" onClick={onNew}><Icon icon={Plus} size={15} /> Open a folder</Button>
      </Stack>
    </div>
  );
}

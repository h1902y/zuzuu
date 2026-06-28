// shell/projects/ProjectsHome.tsx — the launcher (L1, the decided launch landing).
// A warm, editorial list of every recent Project with its health read from disk
// (no daemon running): notes · tables · ◷ pending-review · protected · last activity.
// Framed by the standardised AppHeader (brand + the "Projects" title) and AppFooter
// (count + brand signature); registry coordinates live in Global settings, not here.
// Search + sort + group-by facets; rows are the standardised ListCard. Opening a row
// hands off to useEnterProject. Thin .tsx — projects-model is the tested logic.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Clock, Shield, Plus, Search, Settings } from "lucide-react";
import { api } from "../../lib/api.js";
import { toast } from "../../state/toast.js";
import { useEnterProject } from "../session/use-enter-project.js";
import { projectsView, projectCountLabel, relativeTime, type ProjectSort, type ProjectGroup } from "./projects-model.js";
import type { ProjectSummary } from "#shared/index.js";
import { Stack, Inline, Text, Icon, Button, ThemeToggle, Loading, AppHeader, AppFooter, ListCard, EmojiPicker } from "../../ds/index.js";
import { NewProject } from "./NewProject.js";
import { GlobalSettings } from "./GlobalSettings.js";

const SORTS: { key: ProjectSort; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "name", label: "Name" },
  { key: "pending", label: "Review" },
];

export function ProjectsHome() {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects", "list"], queryFn: api.projects.list });
  const enter = useEnterProject();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProjectSort>("recent");
  const [group, setGroup] = useState<ProjectGroup>("none");
  const [newOpen, setNewOpen] = useState(false);
  const [globalOpen, setGlobalOpen] = useState(false);

  const rows = projects.data?.projects ?? [];
  const sections = projectsView(rows, { search, sort, group });
  const shown = sections.reduce((n, s) => n + s.projects.length, 0);
  const now = Date.now();

  async function onSetEmoji(path: string, emoji: string) {
    try {
      await api.projects.setEmoji(path, emoji);
      void qc.invalidateQueries({ queryKey: ["projects", "list"] });
    } catch { toast("Couldn't set the emoji", "error"); }
  }

  return (
    <div className="flex h-full flex-col bg-app">
      <AppHeader
        title="Projects"
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>
              <Icon icon={Plus} size={15} /> New project
            </Button>
            <Text as="button" interactive tone="muted" onClick={() => setGlobalOpen(true)} title="Global settings">
              <Icon icon={Settings} size={16} />
            </Text>
            <ThemeToggle />
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto w-full max-w-4xl">
          <Stack gap="xl">
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
                        <ProjectRow key={p.path} project={p} now={now} onOpen={() => void enter(p.path)} onSetEmoji={onSetEmoji} />
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

      <AppFooter
        left={<Text size="meta" tone="muted">{projectCountLabel(shown, rows.length)}</Text>}
      />

      {newOpen && <NewProject onClose={() => setNewOpen(false)} />}
      {globalOpen && <GlobalSettings onClose={() => setGlobalOpen(false)} />}
    </div>
  );
}

function ProjectRow({ project: p, now, onOpen, onSetEmoji }: {
  project: ProjectSummary; now: number; onOpen: () => void; onSetEmoji: (path: string, emoji: string) => void;
}) {
  return (
    <ListCard
      onClick={onOpen}
      leading={<EmojiPicker value={p.emoji} onPick={(e) => onSetEmoji(p.path, e)} label={`Change ${p.name} emoji`} />}
      title={p.name}
      badge={p.current ? <Text size="meta" tone="accent">open</Text> : undefined}
      subtitle={p.path}
      trailing={
        <>
          <Text size="meta" tone="muted">{p.notes} {p.notes === 1 ? "note" : "notes"}</Text>
          <Text size="meta" tone="muted">{p.modules} {p.modules === 1 ? "table" : "tables"}</Text>
          {p.pending > 0 && (
            <Inline gap="xs"><Icon icon={Clock} size={13} /><Text size="meta" tone="accent">{p.pending}</Text></Inline>
          )}
          {p.guarded && <Icon icon={Shield} size={14} />}
          <Text size="meta" tone="subtle">{relativeTime(p.lastActivityMs, now)}</Text>
        </>
      }
    />
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

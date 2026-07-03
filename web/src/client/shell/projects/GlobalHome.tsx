// shell/projects/GlobalHome.tsx — the GLOBAL page (§F): the same page grammar as a
// project — a canvas + the greeting — where THE NODES ARE PROJECTS. Replaces the
// editorial ProjectsHome list as the no-workspace landing. A project node carries its
// emoji + counts + a needs-me ring; selecting it opens an inline detail (the inspector
// grammar); Open/⏎ dives into that project's World (the existing enter-project switch).
// The greeting rolls up needs-me across projects. New-project + global settings stay
// reachable (a dialog each). The force ENGINE is intentionally NOT used here — see
// globe-model.ts for why (projects have no islands/links to simulate).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Settings, Shield, Clock, Database } from "lucide-react";
import { api } from "../../lib/api.js";
import { useEnterProject } from "../session/use-enter-project.js";
import { globeNodes, globalGreeting, type GlobeNode } from "./globe-model.js";
import { relativeTime } from "./projects-model.js";
import { Stack, Inline, Text, Icon, Button, ThemeToggle, Loading, AppHeader, AppFooter } from "../../ds/index.js";
import { NewProject } from "./NewProject.js";
import { GlobalSettings } from "./GlobalSettings.js";

const VIEW_W = 1000;
const VIEW_H = 620;

export function GlobalHome() {
  const projects = useQuery({ queryKey: ["projects", "list"], queryFn: api.projects.list });
  const enter = useEnterProject();
  const [newOpen, setNewOpen] = useState(false);
  const [globalOpen, setGlobalOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const rows = projects.data?.projects ?? [];
  const nodes = useMemo(() => globeNodes(rows, { w: VIEW_W, h: VIEW_H }), [rows]);
  const greeting = useMemo(() => globalGreeting(rows, new Date().getHours()), [rows]);
  const sel = nodes.find((n) => n.path === selected) ?? null;
  const now = Date.now();

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

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {projects.isLoading ? (
          <div className="grid h-full place-items-center"><Loading label="reading your projects…" /></div>
        ) : !rows.length ? (
          <EmptyGlobe onNew={() => setNewOpen(true)} />
        ) : (
          <>
            {/* the greeting — needs-me rolled up ACROSS projects (§E.4 / §F) */}
            <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 text-center">
              <Text size="lg" font="display">{greeting.salutation}</Text>
              <div className="mt-0.5 text-meta text-muted">{greeting.brief}</div>
            </div>

            {/* the constellation — shares the world's visual language, not its physics */}
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" role="img" aria-label="all projects">
              {nodes.map((n) => (
                <GlobeDot key={n.path} n={n} active={n.path === selected} onSelect={() => setSelected(n.path)} onOpen={() => void enter(n.path)} />
              ))}
            </svg>

            {/* the project detail — the inspector grammar, in place */}
            {sel && (
              <div className="animate-pop absolute bottom-6 left-1/2 z-20 w-full max-w-md -translate-x-1/2 rounded-lg border border-border bg-elevated p-4 shadow-overlay">
                <Inline gap="sm" align="center" justify="between">
                  <Inline gap="sm" align="center">
                    <span className="text-lg">{sel.emoji}</span>
                    <Stack gap="none">
                      <Text weight="semibold">{sel.name}</Text>
                      <Text size="meta" tone="subtle">{sel.path}</Text>
                    </Stack>
                  </Inline>
                  <Button variant="primary" size="sm" onClick={() => void enter(sel.path)}>Open ⏎</Button>
                </Inline>
                <div className="mt-3">
                  <Inline gap="md" align="center">
                    <Text size="meta" tone="muted">{sel.notes} {sel.notes === 1 ? "note" : "notes"}</Text>
                    <Text size="meta" tone="muted">{sel.modules} {sel.modules === 1 ? "table" : "tables"}</Text>
                    {sel.pending > 0 && <Inline gap="xs"><Icon icon={Clock} size={12} /><Text size="meta" tone="accent">{sel.pending} to review</Text></Inline>}
                    {sel.guarded && <Icon icon={Shield} size={13} />}
                    <Text size="meta" tone="subtle">{relativeTime(sel.lastActivityMs, now)}</Text>
                  </Inline>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AppFooter left={<Text size="meta" tone="muted">{rows.length} {rows.length === 1 ? "project" : "projects"}</Text>} />

      {newOpen && <NewProject onClose={() => setNewOpen(false)} />}
      {globalOpen && <GlobalSettings onClose={() => setGlobalOpen(false)} />}
    </div>
  );
}

/** One project node: a color dot sized by note count, the emoji at its center, a
 *  dashed accent ring when it has pending review (needs-me), the name below. Click
 *  selects (opens the detail); double-click dives straight in. */
function GlobeDot({ n, active, onSelect, onOpen }: { n: GlobeNode; active: boolean; onSelect: () => void; onOpen: () => void }) {
  return (
    <g
      transform={`translate(${n.x} ${n.y})`}
      className="cursor-pointer"
      onClick={onSelect}
      onDoubleClick={onOpen}
      role="button"
      aria-label={`${n.name} — ${n.notes} notes${n.pending ? `, ${n.pending} to review` : ""}`}
    >
      {n.pending > 0 && (
        <circle r={n.r + 6} fill="none" stroke="var(--color-accent, #6ea8fe)" strokeWidth={1.5} strokeDasharray="3 4" opacity={0.8} />
      )}
      <circle r={n.r} fill={n.color} opacity={active ? 1 : 0.85} stroke={active ? "var(--color-ink-100, #fff)" : "none"} strokeWidth={active ? 2 : 0} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={n.r * 0.9}>{n.emoji}</text>
      <text textAnchor="middle" y={n.r + 16} fontSize={13} fill="var(--color-muted, #9aa)" className="select-none">{n.name}</text>
    </g>
  );
}

function EmptyGlobe({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid h-full place-items-center px-8 text-center">
      <Stack gap="md" align="center">
        <Icon icon={Database} size={20} />
        <Text size="lg" font="display">No projects yet</Text>
        <Text size="ui" tone="muted">Open a folder to start. Initialize it, enable your agent, and the brain grows as you work.</Text>
        <Button variant="primary" size="sm" onClick={onNew}><Icon icon={Plus} size={15} /> Open a folder</Button>
      </Stack>
    </div>
  );
}

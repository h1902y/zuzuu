// shell/NavTree.tsx — ONE nav tree, sessions + modules as siblings (no modes, R2).
// Every entry — Overview, the setup row, sessions, tables, project nav — renders through
// the SINGLE `NavRow` primitive (R1): one height, one glyph size, one type size, one
// active/hover treatment. Row composition (which rows, badges, liveness, active) is the
// pure `navModel`; this file only maps a row's glyph/liveness to a ds Icon and wires the
// node into select(). Composed from ds primitives (no inline styles / arbitrary values).
import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Circle, Table2, Flag, Home, Search, Settings as SettingsIcon, Bot } from "lucide-react";
import { api } from "../lib/api.js";
import { useWorkbench } from "../state/store.js";
import { useWorld } from "./world-state.js";
import { mostRecentlyActive } from "./shell-state.js";
import { shouldShowSetupNode } from "./project-home-state.js";
import { navModel, type NavRowModel } from "./nav-model.js";
import { companionView } from "./onboarding/companion-state.js";
import { NewSessionMenu } from "./session/NewSessionMenu.js";
import { Stack, Text, Icon } from "../ds/index.js";

/** The one row primitive. Leading glyph is a ReactNode (a Lucide icon or the session
 *  liveness dot); the optional badge is the pending-proposal count. */
function NavRow({ active, icon, label, badge, onClick }: {
  active: boolean; icon: ReactNode; label: string; badge?: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-full items-center gap-3 rounded-ui px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus ${active ? "bg-selected text-ink-100" : "text-subtle hover:bg-hover hover:text-ink-100"}`}
    >
      <span className="flex shrink-0 items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-ui">{label}</span>
      {badge ? <Text size="meta" tone="accent">{badge}</Text> : null}
    </button>
  );
}

const GLYPH = { overview: Home, setup: Flag, acp: Bot, table: Table2, search: Search, settings: SettingsIcon } as const;

/** A row's leading glyph: the session liveness dot (status-toned) or a uniform 14px nav icon. */
function rowGlyph(row: NavRowModel): ReactNode {
  if (row.glyph === "session") {
    const tone = row.liveness === "owner" ? "accent" : row.liveness === "live" ? "subtle" : "muted";
    return <Text tone={tone}><Icon icon={Circle} size={9} fill={row.liveness === "idle" ? "none" : "currentColor"} /></Text>;
  }
  return <Icon icon={GLYPH[row.glyph]} size={14} />;
}

export function NavTree() {
  const sessions = useWorkbench((s) => s.sessions);
  const acpSessions = useWorkbench((s) => s.acpSessions);
  const selected = useWorld((s) => s.selected);
  const select = useWorld((s) => s.select);
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const projectState = useQuery({ queryKey: ["zuzuu", "project-state"], queryFn: api.zuzuu.projectState });

  const owner = mostRecentlyActive(sessions.map((s) => ({ id: s.id, live: s.alive, lastActiveAt: s.createdAt })));
  const model = navModel({
    selected,
    sessions: sessions.map((s) => ({ id: s.id, title: s.title, alive: s.alive })),
    acpSessions: acpSessions.map((a) => ({ id: a.id, label: a.label })),
    modules: overview.data?.modules ?? [],
    owner,
    showSetup: projectState.data !== undefined && shouldShowSetupNode(projectState.data.state),
    showSearch: false, // U4 — Search is no longer a nav destination; it's reached via ⌘K "see all results"
  });

  // U5 — the setup row reads "Setup n/3" (the pinned progress companion) once the rung is
  // known; navModel ships the generic "Set up this Project" label as the fallback.
  const setupLabel = projectState.data ? companionView(projectState.data.state, sessions.length).label : null;
  const topRows = model.top.map((r) => (r.key === "setup" && setupLabel ? { ...r, label: setupLabel } : r));

  const row = (r: NavRowModel) => (
    <NavRow key={r.key} active={r.active} icon={rowGlyph(r)} label={r.label} badge={r.badge} onClick={() => select(r.node)} />
  );

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col gap-7 overflow-y-auto border-r border-border bg-surface p-4">
      <Stack gap="xs">{topRows.map(row)}</Stack>

      <Stack gap="xs">
        <Text size="meta" tone="subtle" weight="semibold">SESSIONS</Text>
        {model.sessions.map(row)}
        {!model.sessions.length && <Text size="meta" tone="muted">none yet</Text>}
        <NewSessionMenu />
      </Stack>

      <Stack gap="xs">
        <Text size="meta" tone="subtle" weight="semibold">TABLES</Text>
        {model.tables.map(row)}
        {!model.tables.length && <Text size="meta" tone="muted">{overview.isLoading ? "…" : "none yet"}</Text>}
      </Stack>

      {/* PROJECT collapsed to Settings after Graph (U2) + Search (U4) left — pin it to
          the rail footer rather than carry a one-item section header (R2). */}
      <div className="mt-auto">{model.project.map(row)}</div>
    </nav>
  );
}

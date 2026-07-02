// shell/nav-model.ts — the pure row model behind the unified NavTree (U1). Produces the
// ordered nav rows (top · sessions · project) from the current selection + live
// data, so row composition — which rows exist, their badges, session liveness, and the
// active row — is testable without rendering. NavTree maps each row's `glyph`/`liveness`
// to a ds Icon and wires `node` into select(). One row shape for every entry (R1): the
// bespoke SessionRow and the "Set up this Project" link fold into this single model.
import type { NavNode } from "./shell-state.js";

export type NavGlyph = "map" | "overview" | "setup" | "session" | "acp" | "table" | "search" | "settings";
export type Liveness = "owner" | "live" | "idle";

export interface NavRowModel {
  /** stable React key + test handle */
  key: string;
  /** select() target; null = home (the setup row jumps to the onboarding home) */
  node: NavNode | null;
  label: string;
  glyph: NavGlyph;
  active: boolean;
  /** session rows only — drives the liveness dot's fill/tone */
  liveness?: Liveness;
  /** the pending-proposal count, omitted when 0 (rides the Everything row) */
  badge?: number;
}

/** The three logical row groups. NavTree renders the section chrome (headings, the
 *  NewSessionMenu, empty/loading states); this model owns the rows themselves.
 *  (The per-module TABLES group left with the unified Everything view — modules
 *  are a COLUMN/facet there and islands on the map, not nav silos.) */
export interface NavModel {
  top: NavRowModel[];
  sessions: NavRowModel[];
  project: NavRowModel[];
}

export interface NavInput {
  selected: NavNode | null;
  sessions: { id: string; title?: string; alive: boolean }[];
  /** ACP drive-lane sessions — listed in the SESSIONS group with a Bot glyph (U7). */
  acpSessions?: { id: string; label: string }[];
  modules: { id: string; title: string; counts?: { pending?: number } }[];
  /** the most-recently-active session id (mostRecentlyActive) — its dot reads "owner" */
  owner: string | null;
  /** whether the "Set up this Project" row shows (shouldShowSetupNode) */
  showSetup: boolean;
  /** whether Search shows as a project-nav row — it's reached via ⌘K (U4), so default off */
  showSearch?: boolean;
}

const sessionActive = (sel: NavNode | null, id: string): boolean =>
  sel?.kind === "session" && sel.id === id;
const kindActive = (sel: NavNode | null, kind: NavNode["kind"]): boolean =>
  sel?.kind === kind;

export function navModel(input: NavInput): NavModel {
  const { selected, sessions, acpSessions = [], modules, owner, showSetup, showSearch = false } = input;

  // the unified table's badge: every module's pending proposals, one number
  const totalPending = modules.reduce((n, m) => n + (m.counts?.pending ?? 0), 0);
  const top: NavRowModel[] = [
    {
      // map-first (C1): home = the World; a `note` selection is map-anchored too
      key: "map",
      node: null,
      label: "Map",
      glyph: "map",
      active: selected === null || selected.kind === "note",
    },
    {
      // one table over everything — module is a column/facet, not a nav silo
      key: "everything",
      node: { kind: "everything" },
      label: "Everything",
      glyph: "table",
      active: kindActive(selected, "everything"),
      ...(totalPending > 0 ? { badge: totalPending } : {}),
    },
    {
      key: "overview",
      node: { kind: "overview" },
      label: "Overview",
      glyph: "overview",
      active: selected?.kind === "overview",
    },
  ];
  if (showSetup) {
    top.push({ key: "setup", node: null, label: "Set up this Project", glyph: "setup", active: false });
  }

  const sessionRows: NavRowModel[] = sessions.map((s) => ({
    key: `session:${s.id}`,
    node: { kind: "session", id: s.id },
    label: s.title || s.id,
    glyph: "session",
    active: sessionActive(selected, s.id),
    liveness: s.alive ? (s.id === owner ? "owner" : "live") : "idle",
  }));

  // ACP drive-lane sessions — first in the SESSIONS group (the default lane), Bot glyph.
  const acpRows: NavRowModel[] = acpSessions.map((s) => ({
    key: `acp:${s.id}`,
    node: { kind: "acp", id: s.id } as NavNode,
    label: s.label,
    glyph: "acp" as const,
    active: selected?.kind === "acp" && selected.id === s.id,
  }));

  const project: NavRowModel[] = [];
  if (showSearch) {
    project.push({ key: "search", node: { kind: "search" }, label: "Search", glyph: "search", active: kindActive(selected, "search") });
  }
  project.push({ key: "settings", node: { kind: "settings" }, label: "Settings", glyph: "settings", active: kindActive(selected, "settings") });

  return { top, sessions: [...acpRows, ...sessionRows], project };
}

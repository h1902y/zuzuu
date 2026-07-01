// shell/nav-model.ts — the pure row model behind the unified NavTree (U1). Produces the
// ordered nav rows (top · sessions · tables · project) from the current selection + live
// data, so row composition — which rows exist, their badges, session liveness, and the
// active row — is testable without rendering. NavTree maps each row's `glyph`/`liveness`
// to a ds Icon and wires `node` into select(). One row shape for every entry (R1): the
// bespoke SessionRow and the "Set up this Project" link fold into this single model.
import type { NavNode } from "./shell-state.js";

export type NavGlyph = "overview" | "setup" | "session" | "acp" | "table" | "search" | "settings";
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
  /** tables only — the pending-proposal count, omitted when 0 */
  badge?: number;
}

/** The four logical row groups. NavTree renders the section chrome (headings, the
 *  NewSessionMenu, empty/loading states); this model owns the rows themselves. */
export interface NavModel {
  top: NavRowModel[];
  sessions: NavRowModel[];
  tables: NavRowModel[];
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
const moduleActive = (sel: NavNode | null, id: string): boolean =>
  sel?.kind === "module" && sel.id === id;
const kindActive = (sel: NavNode | null, kind: NavNode["kind"]): boolean =>
  sel?.kind === kind;

export function navModel(input: NavInput): NavModel {
  const { selected, sessions, acpSessions = [], modules, owner, showSetup, showSearch = false } = input;

  const top: NavRowModel[] = [
    {
      key: "overview",
      node: { kind: "overview" },
      label: "Overview",
      glyph: "overview",
      active: selected === null || selected.kind === "overview",
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

  const tableRows: NavRowModel[] = modules.map((m) => {
    const pending = m.counts?.pending ?? 0;
    return {
      key: `module:${m.id}`,
      node: { kind: "module", id: m.id },
      label: m.title,
      glyph: "table" as const,
      active: moduleActive(selected, m.id),
      ...(pending > 0 ? { badge: pending } : {}),
    };
  });

  const project: NavRowModel[] = [];
  if (showSearch) {
    project.push({ key: "search", node: { kind: "search" }, label: "Search", glyph: "search", active: kindActive(selected, "search") });
  }
  project.push({ key: "settings", node: { kind: "settings" }, label: "Settings", glyph: "settings", active: kindActive(selected, "settings") });

  return { top, sessions: [...acpRows, ...sessionRows], tables: tableRows, project };
}

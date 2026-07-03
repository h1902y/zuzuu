// src/client/palette/palette-commands.ts — the grouped command model behind the ⌘K
// omnibar (P2.5). Builds the ordered command groups (Navigate · Actions · Switch
// project · Sessions · Tables) from the live context; each command carries a typed
// action descriptor (not a closure) so the grouping/ordering/labeling is pure +
// tested, and PaletteBody just maps the descriptor → a store call. Empty groups drop.
// C3 completes the omnibar: `>` = world commands (fit · module · review), `/` = the
// conversation (routed to the EXISTING ACP lane — the real interactive host).

import { fuzzyScore } from "./palette-logic.js";

export type PaletteAction =
  | { kind: "review" }
  | { kind: "overview" } // legacy deep-link — lands on the map (§D)
  | { kind: "settings-dialog" } // §D: Settings is a dialog, not a screen
  | { kind: "projects-home" }
  | { kind: "new-shell" }
  | { kind: "new-agent"; host: string }
  | { kind: "open-session"; id: string }
  | { kind: "open-module"; id: string }
  | { kind: "switch-project"; path: string }
  // U3 — the Notes (content) group: open a note, expand to the full results view,
  // stage a new note from a no-results query, or a non-selecting placeholder (loading).
  | { kind: "open-note"; module: string; id: string }
  | { kind: "open-everything" } // the unified table (one grid over every module)
  | { kind: "see-all-search"; query: string }
  | { kind: "create-note"; query: string }
  // C3 — the omnibar modes: world camera commands + the ACP conversation hand-off
  | { kind: "world-fit" }
  | { kind: "world-module"; id: string }
  // the Table⇄Map toggle (>table / >map): flip the current module's projection
  | { kind: "module-view"; view: "table" | "graph" }
  // §I rung 5 — >flow: open the in-context workflow's DAG, else Flow home
  | { kind: "open-flow"; module?: string; id?: string }
  | { kind: "converse"; prompt: string }
  // §E.1 stage 2 — the shell's noun verbs: the Record stage for a note, the gate's
  // inline decisions (instant — the human IS the gate), and running a saved view
  // (module '' = the Everything scope; noteKind = the lens's type facet)
  | { kind: "open-row"; module: string; id: string }
  | { kind: "approve-proposal"; module: string; id: string }
  | { kind: "reject-proposal"; module: string; id: string }
  | { kind: "run-view"; module: string; text: string; noteKind: string }
  // §E.3 — the adapter's create resolution: open the DRAFT form pre-filled (the
  // form stages on save — the gate decides; the adapter never writes directly)
  | { kind: "draft-note"; module: string; title: string }
  // §H.3.4 — the table SELECTION's verbs: selection is context, the omnibar is
  // the verb (no bulk action lives as table chrome). Export is a client-side
  // download (instant, no write). Delete is the OPERATOR lane's instant commit
  // (Two-Lanes.md — S1: it used to co-opt the review gate with N self-authored
  // proposals; the agent-lane twin, `zz stage`, is untouched): "-confirm" shows
  // the in-omnibar count-confirm row (Esc cancels, nothing written yet), "-execute"
  // is the second Enter that actually loops the per-row delete route — a batch-verb
  // GAP noted in the review (no single all-or-nothing generation yet).
  | { kind: "export-selection" }
  | { kind: "delete-selection-confirm" }
  | { kind: "delete-selection-execute" }
  | { kind: "noop" };

export interface PaletteCommand {
  /** the fuzzy-matched haystack (lowercased keywords) */
  value: string;
  label: string;
  action: PaletteAction;
  // ── the omnibar shell's row grammar (§E.1/§E.2; all optional — a bare row is
  //    a plain navigate) ──
  /** quiet secondary text after the label (module, path, status…) */
  meta?: string;
  /** which lane Enter acts through — 'instant' (operator) · 'proposal' (agent
   *  lane, the gate decides) · 'nav'. Rendered as a badge: the moat, visible. */
  lane?: import("../omnibar/omni-shell.js").Lane;
  /** right-aligned hint (the palette teaches its keys); defaults from actions */
  hint?: string;
  /** the noun's verb panel (Tab) — each verb is itself a command row */
  actions?: PaletteCommand[];
  /** what the detail pane renders while this row is focused */
  detail?: import("../omnibar/omni-shell.js").DetailRef;
}

export interface PaletteGroup {
  heading: string;
  commands: PaletteCommand[];
}

export interface PaletteContext {
  sessions: { id: string; title?: string }[];
  modules: { id: string; title: string }[];
  recents: { path: string; name: string; current: boolean }[];
  hosts: { id: string; label: string }[];
}

/** Assemble the palette's grouped commands in a fixed display order. Non-current
 *  recents become "Switch project"; empty groups are omitted. */
export function buildPaletteGroups(ctx: PaletteContext): PaletteGroup[] {
  const groups: PaletteGroup[] = [];

  groups.push({
    heading: "Navigate",
    commands: [
      { value: "everything all notes unified table", label: "Everything", action: { kind: "open-everything" } },
      // §D: the Overview page retired — the map + the needs-me HUD carry its signal
      { value: "all projects launcher manage", label: "All projects", action: { kind: "projects-home" } },
      { value: "settings preferences config host", label: "Settings", action: { kind: "settings-dialog" } },
    ],
  });

  groups.push({
    heading: "Actions",
    commands: [
      { value: "review proposals gate pending merge approve", label: "Review proposals", action: { kind: "review" }, hint: "R" },
      { value: "new shell session terminal", label: "New shell", action: { kind: "new-shell" }, lane: "instant" },
      ...ctx.hosts.map((h): PaletteCommand => ({
        value: `new ${h.label.toLowerCase()} agent session`,
        label: `New ${h.label}`,
        action: { kind: "new-agent", host: h.id },
        lane: "instant",
      })),
    ],
  });

  const switchable = ctx.recents.filter((r) => !r.current);
  if (switchable.length) {
    groups.push({
      heading: "Switch project",
      commands: switchable.map((r): PaletteCommand => ({
        value: `switch project ${r.name} ${r.path}`.toLowerCase(),
        label: r.name,
        action: { kind: "switch-project", path: r.path },
      })),
    });
  }

  if (ctx.sessions.length) {
    groups.push({
      heading: "Sessions",
      commands: ctx.sessions.map((s): PaletteCommand => ({
        value: `session ${s.title ?? s.id}`.toLowerCase(),
        label: s.title ?? s.id,
        action: { kind: "open-session", id: s.id },
        meta: "session",
        detail: { kind: "session", id: s.id },
        hint: "↵ resume",
      })),
    });
  }

  if (ctx.modules.length) {
    groups.push({
      heading: "Tables",
      commands: ctx.modules.map((m): PaletteCommand => ({
        value: `table module ${m.title}`.toLowerCase(),
        label: m.title,
        action: { kind: "open-module", id: m.id },
        meta: "table",
        detail: { kind: "module", id: m.id },
        actions: [
          { value: "open-table", label: "Open as table", action: { kind: "open-module", id: m.id } },
          { value: "open-island", label: "Focus the island", action: { kind: "world-module", id: m.id } },
        ],
      })),
    });
  }

  return groups;
}

/** C3 — the omnibar's prefix modes. `/prompt` → ONE converse command (the ACP lane);
 *  `>cmd` → the world commands (fit · review · module <name>, self-filtered — the
 *  palette disables cmdk's filter in omni mode). null = not in an omni mode.
 *  `flow` is §I rung 5's toggle target (the in-context workflow, else Flow home) —
 *  the row is offered even with no workflows yet (it just lands on the picker's
 *  honest empty state, same as `>table`/`>map` never refuse to exist). */
export function omniGroup(
  query: string,
  modules: { id: string; title: string }[],
  flow: { target: { module: string; id: string } | null } = { target: null },
): PaletteGroup | null {
  if (query.startsWith("/")) {
    const prompt = query.slice(1).trim();
    return {
      heading: "Converse",
      commands: [prompt
        ? { value: "omni-converse", label: `Ask the agent — “${prompt}”`, action: { kind: "converse", prompt } }
        : { value: "omni-converse", label: "Ask the agent — type your prompt…", action: { kind: "noop" } }],
    };
  }
  if (query.startsWith(">")) {
    const rest = query.slice(1).trim().toLowerCase();
    const moduleArg = rest.replace(/^module\s*/, "");
    const commands: PaletteCommand[] = [];
    if (!rest || fuzzyScore(rest, "fit") !== null) {
      commands.push({ value: "omni-fit", label: "fit — frame the whole map", action: { kind: "world-fit" } });
    }
    // the two projections of the current module (T also toggles them in place)
    if (!rest || fuzzyScore(rest, "table") !== null) {
      commands.push({ value: "omni-table", label: "table — this module as rows", action: { kind: "module-view", view: "table" } });
    }
    if (!rest || fuzzyScore(rest, "map") !== null) {
      commands.push({ value: "omni-map", label: "map — this module as an island", action: { kind: "module-view", view: "graph" } });
    }
    if (!rest || fuzzyScore(rest, "review") !== null) {
      commands.push({ value: "omni-review", label: "review — open the gate", action: { kind: "review" } });
    }
    if (!rest || fuzzyScore(rest, "everything") !== null) {
      commands.push({ value: "omni-everything", label: "everything — one table over every module", action: { kind: "open-everything" } });
    }
    if (!rest || fuzzyScore(rest, "flow") !== null) {
      commands.push({
        value: "omni-flow",
        label: flow.target ? `flow — ${flow.target.module}:${flow.target.id}'s DAG + runs` : "flow — pick a workflow",
        action: { kind: "open-flow", module: flow.target?.module, id: flow.target?.id },
      });
    }
    for (const m of modules) {
      if (!rest || fuzzyScore(moduleArg, m.id) !== null || fuzzyScore(rest, `module ${m.id}`) !== null) {
        commands.push({ value: `omni-module-${m.id}`, label: `module ${m.id} — focus the island`, action: { kind: "world-module", id: m.id } });
      }
    }
    return commands.length ? { heading: "World", commands } : { heading: "World", commands: [{ value: "omni-none", label: "no matching command", action: { kind: "noop" } }] };
  }
  return null;
}

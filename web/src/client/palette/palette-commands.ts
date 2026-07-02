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
  | { kind: "overview" }
  | { kind: "projects-home" }
  | { kind: "new-shell" }
  | { kind: "new-agent"; host: string }
  | { kind: "open-session"; id: string }
  | { kind: "open-module"; id: string }
  | { kind: "switch-project"; path: string }
  // U3 — the Notes (content) group: open a note, expand to the full results view,
  // stage a new note from a no-results query, or a non-selecting placeholder (loading).
  | { kind: "open-note"; module: string; id: string }
  | { kind: "see-all-search"; query: string }
  | { kind: "create-note"; query: string }
  // C3 — the omnibar modes: world camera commands + the ACP conversation hand-off
  | { kind: "world-fit" }
  | { kind: "world-module"; id: string }
  // the Table⇄Map toggle (>table / >map): flip the current module's projection
  | { kind: "module-view"; view: "table" | "graph" }
  | { kind: "converse"; prompt: string }
  | { kind: "noop" };

export interface PaletteCommand {
  /** the fuzzy-matched haystack (lowercased keywords) */
  value: string;
  label: string;
  action: PaletteAction;
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
      { value: "overview home base", label: "Overview", action: { kind: "overview" } },
      { value: "all projects launcher manage", label: "All projects", action: { kind: "projects-home" } },
    ],
  });

  groups.push({
    heading: "Actions",
    commands: [
      { value: "review proposals gate pending merge approve", label: "Review proposals", action: { kind: "review" } },
      { value: "new shell session terminal", label: "New shell", action: { kind: "new-shell" } },
      ...ctx.hosts.map((h): PaletteCommand => ({
        value: `new ${h.label.toLowerCase()} agent session`,
        label: `New ${h.label}`,
        action: { kind: "new-agent", host: h.id },
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
      })),
    });
  }

  return groups;
}

/** C3 — the omnibar's prefix modes. `/prompt` → ONE converse command (the ACP lane);
 *  `>cmd` → the world commands (fit · review · module <name>, self-filtered — the
 *  palette disables cmdk's filter in omni mode). null = not in an omni mode. */
export function omniGroup(
  query: string,
  modules: { id: string; title: string }[],
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
    for (const m of modules) {
      if (!rest || fuzzyScore(moduleArg, m.id) !== null || fuzzyScore(rest, `module ${m.id}`) !== null) {
        commands.push({ value: `omni-module-${m.id}`, label: `module ${m.id} — focus the island`, action: { kind: "world-module", id: m.id } });
      }
    }
    return commands.length ? { heading: "World", commands } : { heading: "World", commands: [{ value: "omni-none", label: "no matching command", action: { kind: "noop" } }] };
  }
  return null;
}

// src/client/palette/palette-commands.ts — the grouped command model behind the ⌘K
// omnibar (P2.5). Builds the ordered command groups (Navigate · Actions · Switch
// project · Sessions · Tables) from the live context; each command carries a typed
// action descriptor (not a closure) so the grouping/ordering/labeling is pure +
// tested, and PaletteBody just maps the descriptor → a store call. Empty groups drop.

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

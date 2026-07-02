// src/client/omnibar/omni-shell.ts — the omnibar SHELL model (§E.1/§E.2).
//
// The ⌘K palette grows from a flat list into a component shell: a push/pop VIEW
// STACK (Raycast grammar — root list → a noun's action panel → a detail or chat
// surface; Esc pops, never closes-by-surprise) plus the row grammar the spec
// pins: lane (the moat readable in the rows: an 'instant' operator verb vs a
// 'proposal' agent-lane verb) · hint (the palette teaches its own keys) ·
// actions (Tab on a focused noun reveals its verbs) · detail (list + detail
// side-by-side for rich nouns). Pure — PaletteBody renders it; tests drive it.

import type { PaletteCommand } from "../palette/palette-commands.js";

/** Which lane a row acts through — the two-lane doctrine, visible at the input.
 *  'instant' = the operator lane (lands NOW, validated); 'proposal' = the agent
 *  lane (stages, the gate decides); 'nav' = no write at all. */
export type Lane = "instant" | "proposal" | "nav";

/** What the detail pane renders for a focused row (fetched lazily by kind). */
export type DetailRef =
  | { kind: "note"; module: string; id: string }
  | { kind: "module"; id: string }
  | { kind: "proposal"; module: string; id: string }
  | { kind: "session"; id: string; live?: boolean };

/** A pushed surface. The root list is the implicit bottom of the stack. */
export type OmniView =
  | { kind: "actions"; row: PaletteCommand }
  | { kind: "chat"; id: string };

export interface OmniStack { views: OmniView[] }

export const emptyStack: OmniStack = { views: [] };

export function push(s: OmniStack, v: OmniView): OmniStack {
  return { views: [...s.views, v] };
}

export function pop(s: OmniStack): OmniStack {
  return { views: s.views.slice(0, -1) };
}

export function top(s: OmniStack): OmniView | null {
  return s.views[s.views.length - 1] ?? null;
}

/** The breadcrumb lives in the input placeholder (Raycast) — each pushed view
 *  names where you are and how to get back. */
export function placeholderFor(s: OmniStack): string {
  const v = top(s);
  if (!v) return "find anything · >world commands · /ask the agent";
  if (v.kind === "actions") return `${v.row.label} — actions · esc back`;
  return "message the agent · esc back to the list";
}

/** The hint column's text for a row (quiet, right-aligned). The default Enter
 *  affordance stays implicit; a row with an action panel teaches Tab. */
export function hintFor(row: PaletteCommand): string | null {
  if (row.hint) return row.hint;
  if (row.actions?.length) return "⇥ actions";
  return null;
}

/** The lane badge's display text (null = no badge — pure navigation). */
export function laneBadge(lane: Lane | undefined): string | null {
  if (lane === "instant") return "instant";
  if (lane === "proposal") return "proposal";
  return null;
}

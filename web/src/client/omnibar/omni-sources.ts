// src/client/omnibar/omni-sources.ts — the shell's extra noun sources (§E.1 stage 2):
// pending PROPOSALS (the gate as list items — approve/reject inline from the panel),
// saved VIEWS (type:view notes — Enter opens the full live board, U4/live-views plan),
// and the table SELECTION (§H.3.4 — selection is context, the omnibar is the verb).
// Pure builders over already-fetched data; PaletteBody feeds + renders them.

import type { ModuleItem, StagedSummary } from "#shared/index.js";
import { fuzzyScore } from "../palette/palette-logic.js";
import type { PaletteCommand, PaletteGroup } from "../palette/palette-commands.js";
import type { NavNode } from "../shell/shell-state.js";

export interface StagedRow { module: string; s: StagedSummary }

/** The Proposals group: every pending staged change, gate verbs on Tab. Shown on
 *  the root list (they're what needs you) and filtered like any row on a query.
 *  Guards a non-array `staged` (a fetched-shape field) rather than throwing —
 *  the omnibar's fan-out has degraded before (see lib/module-details.ts). */
export function proposalsGroup(staged: StagedRow[]): PaletteGroup | null {
  if (!Array.isArray(staged) || !staged.length) return null;
  return {
    heading: "Proposals",
    commands: staged.map(({ module, s }): PaletteCommand => ({
      value: `proposal ${s.title} ${s.op ?? ""} ${module}`.toLowerCase(),
      label: s.title || s.target || s.id,
      meta: `${s.op ?? "change"} · ${module}`,
      lane: "proposal",
      detail: { kind: "proposal", module, id: s.id },
      action: { kind: "review" }, // Enter opens the gate focused on the queue
      hint: "⇥ approve/reject",
      actions: [
        { value: "approve", label: "Approve — land it", lane: "instant", action: { kind: "approve-proposal", module, id: s.id } },
        { value: "reject", label: "Reject", lane: "instant", action: { kind: "reject-proposal", module, id: s.id } },
        { value: "open-gate", label: "Open the gate", action: { kind: "review" } },
      ],
    })),
  };
}

/** U4 (live-views plan): the board nav a saved view's Enter now resolves to.
 *  The view NOTE's own `module`/`id` name the note itself (mirrors
 *  `noteOrFlowNav`'s `{kind:"flow"}` shape for its sibling projection) —
 *  `ViewBoard` reads the note's `query` frontmatter (via U1's mappers) to
 *  resolve the module/where/group-by/sort the board actually runs over. This
 *  is deliberately NOT a lens: the omnibar never re-serializes the query, it
 *  just opens the note as a live board, so the WHOLE query applies (the old
 *  `viewLens` — text/kind/module only — is retired; no other caller depended
 *  on it, confirmed by grep). Pure + unit-testable, same seam as
 *  `noteOrFlowNav`. */
export function runViewNav(item: ModuleItem): Extract<NavNode, { kind: "view" }> {
  return { kind: "view", module: item.module, id: item.id };
}

/** The Views group: saved views (type:view notes) as rows — Enter opens the
 *  live board (the note's whole query applied, U4), not a partial lens on
 *  the module table. */
export function viewsGroup(items: ModuleItem[], query: string): PaletteGroup | null {
  if (!Array.isArray(items)) return null;
  const views = items.filter((it) => it.kind === "view");
  if (!views.length) return null;
  const q = query.trim().toLowerCase();
  const match = q
    ? views.filter((v) => `view ${v.title} ${v.id}`.toLowerCase().includes(q) || fuzzyScore(q, `${v.title} ${v.id}`) !== null)
    : views;
  if (!match.length) return null;
  return {
    heading: "Views",
    commands: match.map((v): PaletteCommand => {
      const nav = runViewNav(v);
      return {
        value: `view ${v.title} ${v.id}`.toLowerCase(),
        label: v.title || v.id,
        meta: `view · ${v.module}`,
        detail: { kind: "note", module: v.module, id: v.id },
        hint: "↵ open",
        action: { kind: "run-view", module: nav.module, id: nav.id },
      };
    }),
  };
}

/** The Selection group (§H.3.4): appears the instant a table selection exists —
 *  the omnibar's context, ranked ahead of the ordinary command groups (it's what
 *  the user is doing RIGHT NOW). Verbs this pass: export (instant, client-side)
 *  and delete (S1/Two-Lanes.md: the OPERATOR's delete lands instantly through the
 *  daemon's per-row commit route — never the review gate, which is the agent-lane
 *  twin's job. The destructive-safe-by-default instinct is met by an in-omnibar
 *  count-confirm step, not by co-opting the gate — see `delete-selection-confirm`
 *  in PaletteBody). `count` is ALREADY the current-scope, current-view count (the
 *  caller scopes it via `selectionFor` — S2); this group never re-derives it.
 *  set-field-across-selection is skipped (the omnibar's form plumbing would make
 *  it heavy for this pass) and relate-all-to isn't built either — noted, not built. */
export function selectionGroup(count: number): PaletteGroup | null {
  if (count < 1) return null;
  return {
    heading: "Selection",
    commands: [
      {
        value: "selection export csv download",
        label: `Export ${count} as CSV`,
        meta: "selection",
        lane: "instant",
        hint: "↵ download",
        action: { kind: "export-selection" },
      },
      {
        value: "selection delete remove",
        label: `Delete ${count} selected`,
        meta: "selection",
        lane: "instant",
        hint: "↵ confirm",
        action: { kind: "delete-selection-confirm" },
      },
    ],
  };
}

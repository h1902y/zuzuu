// src/client/omnibar/omni-sources.ts — the shell's extra noun sources (§E.1 stage 2):
// pending PROPOSALS (the gate as list items — approve/reject inline from the panel),
// saved VIEWS (type:view notes — run applies the lens both projections share), and
// the table SELECTION (§H.3.4 — selection is context, the omnibar is the verb).
// Pure builders over already-fetched data; PaletteBody feeds + renders them.

import type { ModuleItem, StagedSummary } from "#shared/index.js";
import { fuzzyScore } from "../palette/palette-logic.js";
import type { PaletteCommand, PaletteGroup } from "../palette/palette-commands.js";

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

/** The lens a `type: view` note carries, mapped onto the shared filter store's
 *  axes. Only the axes the workbench lens HAS are applied (text · kind · module);
 *  `where`/aggregates stay CLI-side — an honest partial application, named so. */
export function viewLens(item: ModuleItem): { module: string; text: string; noteKind: string } {
  const q = (item as unknown as Record<string, unknown>).query;
  const qq = q && typeof q === "object" && !Array.isArray(q) ? (q as Record<string, unknown>) : {};
  return {
    module: typeof qq.module === "string" ? qq.module : "",
    text: typeof qq.text === "string" ? qq.text : "",
    noteKind: typeof qq.type === "string" ? qq.type : "",
  };
}

/** The Views group: saved views (type:view notes) as rows — Enter RUNS the view
 *  (applies its lens and opens the scope's table; T then shows the same lens as a
 *  spotlight on the map — one filter state, two projections). */
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
      const lens = viewLens(v);
      return {
        value: `view ${v.title} ${v.id}`.toLowerCase(),
        label: v.title || v.id,
        meta: `view · ${lens.module || "everything"}`,
        detail: { kind: "note", module: v.module, id: v.id },
        hint: "↵ run",
        action: { kind: "run-view", ...lens },
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

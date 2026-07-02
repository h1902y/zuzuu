// src/client/omnibar/omni-sources.ts — the shell's extra noun sources (§E.1 stage 2):
// pending PROPOSALS (the gate as list items — approve/reject inline from the panel)
// and saved VIEWS (type:view notes — run applies the lens both projections share).
// Pure builders over already-fetched data; PaletteBody feeds + renders them.

import type { ModuleItem, StagedSummary } from "#shared/index.js";
import { fuzzyScore } from "../palette/palette-logic.js";
import type { PaletteCommand, PaletteGroup } from "../palette/palette-commands.js";

export interface StagedRow { module: string; s: StagedSummary }

/** The Proposals group: every pending staged change, gate verbs on Tab. Shown on
 *  the root list (they're what needs you) and filtered like any row on a query. */
export function proposalsGroup(staged: StagedRow[]): PaletteGroup | null {
  if (!staged.length) return null;
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

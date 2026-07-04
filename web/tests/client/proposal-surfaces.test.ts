// U2 — apply the shared proposal-state across surfaces (palette · review card ·
// table pending-row register · World ghost alignment). Framework-free: pure
// model/source-text tests, no DOM (see vital-signs-equivalent conventions in
// proposal-state.test.ts / ds-no-inline.test.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ModuleItem, StagedSummary } from "#shared/index.js";
import { mergeTableRows, isPendingRow, type PendingRow } from "../../src/client/shell/stage/table-model.js";
import { proposalRecipe } from "../../src/client/ds/recipes/proposal.js";
import { GHOST_STROKE_TOKEN } from "../../src/client/world/model.js";

const note = (over: Partial<ModuleItem> = {}): ModuleItem =>
  ({ id: "n1", module: "knowledge", kind: "concept", title: "Note One", status: "active", ...over }) as ModuleItem;

const staged = (over: Partial<StagedSummary> = {}): StagedSummary =>
  ({ id: "s1", module: "knowledge", title: "New idea", op: "create", ...over }) as StagedSummary;

describe("table pending-row register (U2) — the new register mergeTableRows adds", () => {
  it("a staged create is represented as a pending row (the new register — none existed before)", () => {
    const rows = mergeTableRows([], [staged({ op: "create", title: "Fresh note" })]);
    expect(rows).toHaveLength(1);
    expect(isPendingRow(rows[0]!)).toBe(true);
  });

  it("a staged update is ALSO a pending row, additive alongside the real (landed) row", () => {
    const real = note({ id: "n1" });
    const rows = mergeTableRows([real], [staged({ id: "s2", op: "update", target: "n1", title: "n1" })]);
    expect(rows).toHaveLength(2);
    expect(rows.filter(isPendingRow)).toHaveLength(1);
    // the real row is untouched — pending is additive, never a mutation
    expect(rows.find((r) => !isPendingRow(r))).toEqual(real);
  });

  it("marks a pending row DISTINCTLY from a real note row (the discriminant)", () => {
    const rows = mergeTableRows([note()], [staged()]);
    expect(rows).toHaveLength(2);
    expect(isPendingRow(rows[0]!)).toBe(false);
    expect(isPendingRow(rows[1]!)).toBe(true);
  });

  it("a pending row carries the staged id + op (what U8's later accept gesture needs)", () => {
    const rows = mergeTableRows([], [staged({ id: "s9", op: "create", title: "X" })]);
    const p = rows[0] as PendingRow;
    expect(p.stagedId).toBe("s9");
    expect(p.op).toBe("create");
    expect(p.module).toBe("knowledge");
  });

  it("an update's row id resolves to its TARGET (the note it amends), a create's to its own staged id", () => {
    const createRow = mergeTableRows([], [staged({ id: "s1", op: "create", target: null })])[0] as PendingRow;
    const updateRow = mergeTableRows([], [staged({ id: "s2", op: "update", target: "n1" })])[0] as PendingRow;
    expect(createRow.id).toBe("s1");
    expect(updateRow.id).toBe("n1");
  });

  it("delete/relate/deprecate proposals are NOT rendered as pending rows this pass (no stable row shape) — noted, not silently merged in wrong", () => {
    const rows = mergeTableRows([], [
      staged({ op: "delete", target: "n1" }),
      staged({ id: "s3", op: "relate", target: "n1" }),
      staged({ id: "s4", op: "deprecate", target: "n1" }),
    ]);
    expect(rows).toHaveLength(0);
  });

  it("an absent op defaults to create (mirrors world/model.ts's reconcileGhosts convention)", () => {
    const rows = mergeTableRows([], [staged({ op: undefined })]);
    expect(rows).toHaveLength(1);
    expect((rows[0] as PendingRow).op).toBe("create");
  });
});

describe("World ghost alignment (U2) — sourced from the shared proposal token, not the old mint", () => {
  const worldCss = readFileSync(fileURLToPath(new URL("../../src/client/world/world.css", import.meta.url)), "utf8");
  const indexCss = readFileSync(fileURLToPath(new URL("../../src/client/index.css", import.meta.url)), "utf8");

  it("model.ts names --color-proposal as the ghost's stroke/fill source", () => {
    expect(GHOST_STROKE_TOKEN).toBe("--color-proposal");
  });

  it("world.css's ghost circle + text draw from --color-proposal (violet), not --color-accent (mint)", () => {
    const start = worldCss.indexOf(".zz-world-ghost circle");
    const end = worldCss.indexOf(".zz-world-chips");
    const ghostBlock = worldCss.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(ghostBlock).toMatch(/fill:\s*var\(--color-proposal\)/);
    expect(ghostBlock).toMatch(/stroke:\s*var\(--color-proposal\)/);
    expect(ghostBlock).not.toMatch(/var\(--color-accent\)/);
  });

  it("solidify (approve = becomes real) still snaps to --color-accent — unchanged, so pending/real stay distinguishable", () => {
    const m = indexCss.match(/@keyframes zz-world-solidify\s*\{[\s\S]*?\n\}/);
    expect(m).toBeTruthy();
    expect(m?.[0]).toMatch(/stroke:\s*var\(--color-accent\)/);
    expect(m?.[0]).not.toMatch(/var\(--color-proposal\)/);
  });
});

describe("palette + review card proposal chrome — resolve through ProposalBadge/proposalRecipe (U2), not a hand-rolled span", () => {
  const paletteSrc = readFileSync(fileURLToPath(new URL("../../src/client/palette/PaletteBody.tsx", import.meta.url)), "utf8");
  const cardSrc = readFileSync(fileURLToPath(new URL("../../src/client/shell/review/ProposalCard.tsx", import.meta.url)), "utf8");

  it("the palette's proposal-lane row renders the shared ProposalBadge", () => {
    expect(paletteSrc).toContain('import { ProposalBadge } from "../ds/index.js";');
    expect(paletteSrc).toMatch(/badge === "proposal" && <ProposalBadge/);
  });

  it("the palette no longer hand-rolls a dashed-warning proposal span", () => {
    expect(paletteSrc).not.toMatch(/border-dashed border-border px-1 text-meta text-warning/);
  });

  it("the review card renders ProposalBadge for the proposal chip, not the solid module-hue Chip", () => {
    expect(cardSrc).toMatch(/<ProposalBadge state="pending" label=\{c\.label\}\s*\/>/);
    expect(cardSrc).not.toMatch(/<Chip label=\{c\.label\} tone=\{c\.tone\}\s*\/>/);
  });

  it("both surfaces resolve to the SAME recipe output the pending badge uses (parity, not two more dialects)", () => {
    const pendingClass = proposalRecipe({ state: "pending" });
    // ProposalBadge (used by both surfaces) is a thin span over proposalBadgeVariant,
    // whose className is proposalRecipe({state}) verbatim — asserted in proposal-state.test.ts;
    // here we just confirm neither surface diverged onto its own literal class string.
    expect(pendingClass).toContain("border-proposal");
    expect(paletteSrc).not.toMatch(/text-warning/);
  });
});

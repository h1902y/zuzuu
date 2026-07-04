// U8 — in-place accept unification: approve a proposal WHERE YOU MEET IT — a
// pending table row (NotesTable.tsx), an inline note proposal (NoteDocument.tsx),
// and the World ghost (already aligned in U2). Framework-free: pure model +
// source-text tests, no DOM (this suite's convention — see proposal-surfaces.test.ts
// / hitl-canvas.test.ts). All three route through the EXISTING gate
// (`dataProvider.approve/reject` via `use-review-queue.ts`, KTD5) — nothing here
// invents a new landing path.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ModuleItem, StagedSummary } from "#shared/index.js";
import {
  mergeTableRows, isPendingRow, pendingRowIntent, solidifyPendingRow, type PendingRow,
} from "../../src/client/shell/stage/table-model.js";
import { pendingProposalsForNote } from "../../src/client/note/note-document-model.js";
import { proposalRecipe } from "../../src/client/ds/recipes/proposal.js";

const note = (over: Partial<ModuleItem> = {}): ModuleItem =>
  ({ id: "n1", module: "knowledge", kind: "concept", title: "Concept One", status: "active", ...over }) as ModuleItem;

const staged = (over: Partial<StagedSummary> & { id: string; module: string }): StagedSummary =>
  ({ title: over.id.toUpperCase(), op: "update", target: "n1", ...over });

// ─────────────────────────────────────────────────────────────────────────────
// (1) the pending table row's click-accept — the intent + the post-approve
//     transition (isPendingRow flips off once the gate confirms).
// ─────────────────────────────────────────────────────────────────────────────

describe("pending table row — click-accept lands via the EXISTING gate (U8)", () => {
  const row: PendingRow = { pending: true, stagedId: "s9", module: "knowledge", op: "update", id: "n1", title: "Concept One" };

  it("pendingRowIntent yields exactly the approve(id, module) pair dataProvider.approve takes — the staged proposal's OWN id, not the target note's", () => {
    expect(pendingRowIntent(row)).toEqual({ id: "s9", module: "knowledge" });
  });

  it("a create row's intent still resolves correctly (stagedId === id for a create — no landed target yet)", () => {
    const createRow: PendingRow = { pending: true, stagedId: "s1", module: "knowledge", op: "create", id: "s1", title: "Fresh" };
    expect(pendingRowIntent(createRow)).toEqual({ id: "s1", module: "knowledge" });
  });

  it("solidifyPendingRow marks the row solidifying (drives the shared 'approving' look) while it is STILL a PendingRow — pure, never mutates the input", () => {
    const solidified = solidifyPendingRow(row);
    expect(solidified.solidifying).toBe(true);
    expect(isPendingRow(solidified)).toBe(true); // not landed yet — only the LOOK transitioned
    expect(row.solidifying).toBeUndefined(); // the original row is untouched
  });

  it("once the gate confirms (refetch drops the approved staged entry), the row is no longer a PendingRow at all — the real transition to 'real'", () => {
    const landed = note({ id: "n1", module: "knowledge", title: "Concept One (updated)" });
    // BEFORE approve resolves: the staged update is still in flight
    const before = mergeTableRows([note({ id: "n1", module: "knowledge" })], [staged({ id: "s9", module: "knowledge" })]);
    expect(before).toHaveLength(2);
    expect(before.filter(isPendingRow)).toHaveLength(1);
    // AFTER approve + invalidate: the staged entry is gone (server confirmed), the
    // (now-updated) landed note is the only row for n1 — isPendingRow flips off.
    const after = mergeTableRows([landed], []);
    expect(after).toHaveLength(1);
    expect(isPendingRow(after[0]!)).toBe(false);
  });

  it("a reject resolves through the SAME (id, module) intent — a row's reject is not a bespoke call, just approve's sibling", () => {
    // reject takes the same (id, module) pair as approve, plus a reason the
    // caller supplies (the reason taxonomy, review-model.ts's REJECT_REASONS) —
    // pendingRowIntent is shared by both gestures, not duplicated per-verb.
    const intent = pendingRowIntent(row);
    expect(intent).toEqual({ id: "s9", module: "knowledge" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) the inline note accept's model — resolving THIS note's pending
//     proposal(s) from the shared staged queue, client-side only.
// ─────────────────────────────────────────────────────────────────────────────

describe("pendingProposalsForNote — the inline note accept's client-only lookup (U8)", () => {
  it("matches a staged UPDATE that targets this note", () => {
    const queue = [staged({ id: "s1", module: "knowledge", op: "update", target: "n1" })];
    expect(pendingProposalsForNote(queue, "knowledge", "n1")).toHaveLength(1);
  });

  it("matches a staged DEPRECATE/DELETE too — any op that targets this landed note, not only update", () => {
    const queue = [
      staged({ id: "s1", module: "knowledge", op: "deprecate", target: "n1" }),
      staged({ id: "s2", module: "knowledge", op: "delete", target: "n1" }),
    ];
    expect(pendingProposalsForNote(queue, "knowledge", "n1").map((s) => s.id).sort()).toEqual(["s1", "s2"]);
  });

  it("a CREATE never matches an existing note id — target is null/absent for one by convention (mirrors world/model.ts's reconcileGhosts)", () => {
    const queue = [staged({ id: "s2", module: "knowledge", op: "create", target: null })];
    expect(pendingProposalsForNote(queue, "knowledge", "n1")).toHaveLength(0);
  });

  it("scoped to the note's OWN module + id — a same-id proposal in a different module never leaks in", () => {
    const queue = [staged({ id: "s3", module: "library", op: "update", target: "n1" })];
    expect(pendingProposalsForNote(queue, "knowledge", "n1")).toHaveLength(0);
  });

  it("returns ALL matches, not just the first — a note can carry more than one in-flight proposal", () => {
    const queue = [
      staged({ id: "s4", module: "knowledge", op: "update", target: "n1" }),
      staged({ id: "s5", module: "knowledge", op: "deprecate", target: "n1" }),
    ];
    expect(pendingProposalsForNote(queue, "knowledge", "n1").map((s) => s.id).sort()).toEqual(["s4", "s5"]);
  });

  it("an empty queue (no pending modules) resolves to no proposals, honestly — never invents one", () => {
    expect(pendingProposalsForNote([], "knowledge", "n1")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) all three in-place surfaces derive their pending look from the shared
//     proposal-state (U1) — never a bespoke class, and all route through the
//     existing gate (KTD5).
// ─────────────────────────────────────────────────────────────────────────────

describe("in-place surfaces resolve through the shared proposal-state (U1), not bespoke classes", () => {
  const tableSrc = readFileSync(fileURLToPath(new URL("../../src/client/shell/stage/NotesTable.tsx", import.meta.url)), "utf8");
  const noteSrc = readFileSync(fileURLToPath(new URL("../../src/client/note/NoteDocument.tsx", import.meta.url)), "utf8");
  const worldCss = readFileSync(fileURLToPath(new URL("../../src/client/world/world.css", import.meta.url)), "utf8");

  it("the table's pending-row accept renders ProposalBadge and plays the shared pulse/solidify motion (no hand-rolled equivalents)", () => {
    expect(tableSrc).toMatch(/ProposalBadge/);
    expect(tableSrc).toMatch(/animate-proposal-pulse/);
    expect(tableSrc).toMatch(/animate-proposal-solidify/);
  });

  it("the table row's accept/reject dispatch through use-review-queue's approve/reject — the SAME gate the review queue uses (KTD5), not a new call", () => {
    expect(tableSrc).toContain('from "../review/use-review-queue.js"');
    expect(tableSrc).toMatch(/pendingRowIntent/);
  });

  it("the inline note accept renders ProposalBadge and the shared motion classes, not a bespoke pending look", () => {
    expect(noteSrc).toMatch(/ProposalBadge/);
    expect(noteSrc).toMatch(/animate-proposal-(pulse|solidify|dissolve)/);
  });

  it("the inline note accept dispatches through use-review-queue's approve/reject — the same gate (KTD5), reusing the review queue's own hook rather than a bespoke fetch", () => {
    expect(noteSrc).toContain('from "../shell/review/use-review-queue.js"');
    expect(noteSrc).toMatch(/pendingProposalsForNote/);
  });

  it("the World ghost (U2, verified/aligned in U8) still draws its pending stroke/fill from --color-proposal, never a reintroduced bespoke hue", () => {
    const start = worldCss.indexOf(".zz-world-ghost circle");
    const end = worldCss.indexOf(".zz-world-chips");
    const ghostBlock = worldCss.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(ghostBlock).toMatch(/var\(--color-proposal\)/);
    expect(ghostBlock).not.toMatch(/var\(--color-accent\)/);
  });

  it("every surface's pending/approving badge resolves to the SAME proposalRecipe output — one dialect, not three separate ones", () => {
    expect(proposalRecipe({ state: "pending" })).toContain("border-proposal");
    expect(proposalRecipe({ state: "approving" })).toContain("animate-proposal-solidify");
  });
});

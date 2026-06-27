// shell/review/session-close-card.ts — the pure logic behind the "what this session
// taught" close card (U5/R5). The .tsx stays thin; the detection + dedup + the
// count-by-type / top-pattern derivations live here (tested, no DOM).
//
// The card fires at the reflective moment an AGENT session ends — but only when that
// close staged something (pending > 0) and only ONCE per session-end. Dedup is keyed
// by session id in sessionStorage so a dismiss-without-review does NOT re-fire for
// that session (the count survives a re-poll / a remount within the tab's lifetime).
import type { HeldSession, StagedSummary } from "#shared/index.js";
import { reasonLine } from "./reason-line.js";
import { proposalChip } from "./proposal-chip.js";

const FIRED_PREFIX = "zz-close-card-fired:";

// ── The card's data (one review for the whole session: CODE + brain, U6) ──────

/** The held session's CODE review — the diff summary + mergeability the card's code
 *  section renders, plus the `id` its Merge / Discard actions take. Null on the card
 *  when the session landed nothing held (auto-merged, a shell, or after Merge collapsed it). */
export interface CloseCardCode {
  /** the session id (the merge/discard action handle). */
  id: string;
  branch: string;
  files: number;
  added: number;
  removed: number;
  checkpoints: number;
  mergeability: "ready" | "conflict" | "unknown";
}

export interface CloseCardData {
  sessionId: string;
  pending: number;
  staged: StagedSummary[];
  /** the held CODE review beside the brain proposals — null = brain-only. */
  code: CloseCardCode | null;
}

/** Decide whether to surface the close card for an ended agent session. Fire iff the
 *  session hasn't already fired AND it has SOMETHING to review — held code changes OR
 *  staged brain proposals (so a code-only session cards too, the U6/P1 gap). Pure (the
 *  caller supplies `heldChanges` + `alreadyFired`). */
export function shouldFireCloseCard(sessionId: string, pending: number, heldChanges: number, alreadyFired: boolean): boolean {
  if (alreadyFired) return false;
  if (!sessionId) return false;
  return pending > 0 || heldChanges > 0;
}

/** The held session's change magnitude — what the fire condition counts. A finalized
 *  session with files touched OR checkpoints recorded is a code review awaiting a
 *  decision. Zero (no code) for a brain-only / auto-merged session. */
export function heldChangesOf(code: CloseCardCode | null | undefined): number {
  if (!code) return 0;
  return code.files + code.checkpoints;
}

/** Map a held-session DTO (GET /api/zuzuu/held) onto the card's code section. */
export function codeFromHeld(held: HeldSession): CloseCardCode {
  return {
    id: held.id,
    branch: held.branch,
    files: held.files,
    added: held.added,
    removed: held.removed,
    checkpoints: held.checkpoints,
    mergeability: held.mergeability,
  };
}

/** Find the held entry for an ended session: by its held branch (the close result's
 *  `held` variant carries it), falling back to an id match. Undefined when nothing in
 *  the workspace's held list is this session (it merged, or was a shell). */
export function pickHeld(held: HeldSession[], branch: string | undefined, sessionId: string): HeldSession | undefined {
  if (branch) {
    const byBranch = held.find((h) => h.branch === branch);
    if (byBranch) return byBranch;
  }
  return held.find((h) => h.id === sessionId);
}

/** The card after its CODE decision resolves (Merge / Discard / Keep): the code
 *  section collapses, leaving a brain-only card — or NULL when no brain proposals
 *  remain (the card clears). Preserves the "one gate" intent: a Merge with pending
 *  brain proposals keeps "Review now" alive rather than a full dismiss. */
export function cardWithoutCode(card: CloseCardData): CloseCardData | null {
  if (card.pending > 0) return { ...card, code: null };
  return null;
}

// ── The merge action's state machine (idle → merging → merged | error) ────────

export type MergePhase = "idle" | "merging" | "merged" | "error";
export interface MergeState {
  phase: MergePhase;
  /** the inline error message (only meaningful when phase === "error"). */
  error?: string;
}
export type MergeEvent =
  | { type: "start" }
  | { type: "ok" }
  | { type: "fail"; error: string }
  | { type: "reset" };

export const initialMergeState: MergeState = { phase: "idle" };

/** The merge/discard action reducer: never silent — a failure lands in `error` with
 *  the message and the card stays (the buttons re-enable for a retry). */
export function mergeReducer(state: MergeState, ev: MergeEvent): MergeState {
  switch (ev.type) {
    case "start": return { phase: "merging" };
    case "ok": return { phase: "merged" };
    case "fail": return { phase: "error", error: ev.error };
    case "reset": return { phase: "idle" };
  }
}

/** Has this session's close card already fired this tab session? (sessionStorage-backed,
 *  SSR/no-storage safe). */
export function closeCardFired(sessionId: string, store: Pick<Storage, "getItem"> | undefined = safeSessionStorage()): boolean {
  if (!store) return false;
  try { return store.getItem(FIRED_PREFIX + sessionId) === "1"; } catch { return false; }
}

/** Mark a session's close card as fired (idempotent; never throws). */
export function markCloseCardFired(sessionId: string, store: Pick<Storage, "setItem"> | undefined = safeSessionStorage()): void {
  if (!store) return;
  try { store.setItem(FIRED_PREFIX + sessionId, "1"); } catch { /* storage full / disabled */ }
}

/** "Keep on branch" — an explicit acknowledged DEFER. Same per-session dedup key as a
 *  dismiss (so it won't re-nag this tab), named to signal the intent: the held session
 *  isn't dropped — it re-surfaces in `zz session status` / the digest. */
export const markCloseCardDeferred = markCloseCardFired;

function safeSessionStorage(): Storage | undefined {
  try { return typeof sessionStorage !== "undefined" ? sessionStorage : undefined; } catch { return undefined; }
}

export interface TypeCount {
  /** the chip label (Knowledge / Action / Guardrail / …) */
  label: string;
  count: number;
}

/** Count the staged proposals by their note-kind chip label — the card's headline
 *  ("2 Knowledge · 1 Guardrail"). Keyed on the chip the proposal would carry at the
 *  gate (note type first, then module — same rule as ProposalCard). Returned in
 *  descending count, then label, for a stable readout. */
export function countByType(staged: StagedSummary[]): TypeCount[] {
  const tally = new Map<string, number>();
  for (const p of staged) {
    const { label } = proposalChip(p.change?.type, p.module);
    tally.set(label, (tally.get(label) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export interface ClosePattern {
  id: string;
  module: string;
  /** the reason line — the human "because you … I want to …" sentence. */
  reason: string;
}

/** The top-N mined patterns for the card body — each a staged proposal rendered as
 *  its reason line (reusing U1's reasonLine over the proposal's evidence). */
export function topPatterns(staged: StagedSummary[], n = 3): ClosePattern[] {
  return staged.slice(0, n).map((p) => ({
    id: p.id,
    module: p.module,
    reason: reasonLine(p.evidence?.[0]?.kind, p.evidence),
  }));
}

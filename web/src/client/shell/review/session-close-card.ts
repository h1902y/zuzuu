// shell/review/session-close-card.ts — the pure logic behind the "what this session
// taught" close card (U5/R5). The .tsx stays thin; the detection + dedup + the
// count-by-type / top-pattern derivations live here (tested, no DOM).
//
// The card fires at the reflective moment an AGENT session ends — but only when that
// close staged something (pending > 0) and only ONCE per session-end. Dedup is keyed
// by session id in sessionStorage so a dismiss-without-review does NOT re-fire for
// that session (the count survives a re-poll / a remount within the tab's lifetime).
import type { StagedSummary } from "#shared/index.js";
import { reasonLine } from "./reason-line.js";
import { proposalChip } from "./proposal-chip.js";

const FIRED_PREFIX = "zz-close-card-fired:";

/** Decide whether to surface the close card for an ended agent session.
 *  Fire iff there are staged proposals AND this session hasn't already fired —
 *  pure (the caller supplies `alreadyFired` from sessionStorage). */
export function shouldFireCloseCard(sessionId: string, pending: number, alreadyFired: boolean): boolean {
  if (alreadyFired) return false;
  if (!sessionId) return false;
  return pending > 0;
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

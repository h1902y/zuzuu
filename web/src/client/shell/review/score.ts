// shell/review/score.ts — the scorer (U4): confidence × blast-radius → an attention
// score. DISPLAY + SORT ONLY (KTD4, the moat) — this file computes and classifies; it
// never approves, rejects, lands, or otherwise mutates a proposal. It has NO import of
// dataProvider/api/review-flow, and exports no function that takes an id/module pair
// and does anything but return a number or a label — see scorer.test.ts's structural
// assertion, which greps this file to guard that boundary as the codebase evolves.
//
// Blast-radius tiers — how much damage a WRONG approve of this proposal could do.
// Explicit, ordered highest→lowest:
//   - "critical": op === "delete" (irreversible removal) or a structural/schema-shaped
//     op ("schema-change" — no current producer emits this via the staged queue since
//     schema evolution mints its own generation via `zz module add-column`, but the
//     tier is defined defensively in case a future producer stages one). These are the
//     two ops a wrong approve can't just be undone by re-approving the old value.
//   - "elevated": ANY write (create/update/delete-already-critical/relate/unrelate/
//     deprecate) that TARGETS a protected/high-value module — "guardrails" (the
//     tool-gate's safety-floor rule notes) or "instructions" (standing agent
//     guidance). Getting one of these wrong doesn't just misinform a reader, it
//     reshapes future agent behavior — higher blast than an ordinary note write, per
//     the plan's explicit framing.
//   - "low" — everything else: a create/update/relate/unrelate/deprecate on an
//     ordinary module (knowledge/actions/memory) — a note-body append/update, the
//     plan's explicit low-blast baseline. Contained to one note, reversible (reject
//     or re-approve the prior value).
// A StagedSummary is always assignable here (structural typing) — but `op` is
// widened to `string` rather than pinned to StagedSummary's current op union, so a
// future producer's op string (e.g. a "schema-change" the queue doesn't emit today)
// is still classifiable without a type error. Every scorer function below takes this
// shape, never the full StagedSummary — score.ts only ever needs op/module/confidence.
export interface ScorableProposal {
  op?: string;
  module: string;
  confidence?: string | null;
}

export type BlastTier = "critical" | "elevated" | "low";

/** tier → its dominant weight in the score (see attentionScore). Ordered so blast
 *  ALWAYS outranks confidence — the gap between tiers (10) is wider than the full
 *  confidence adjustment range (0..3), so no confidence value can push a lower tier
 *  above a higher one. */
const TIER_WEIGHT: Record<BlastTier, number> = { critical: 30, elevated: 20, low: 10 };

/** The two ops nothing can safely undo by re-approving the prior value. */
const DESTRUCTIVE_OPS = new Set(["delete", "schema-change"]);

/** Modules whose content shapes agent BEHAVIOR (not just recorded understanding) — a
 *  bad write here has outsized reach vs. a bad write to knowledge/memory/actions. */
const PROTECTED_MODULES = new Set(["guardrails", "instructions"]);

/** blast-radius classification — op + target module, nothing else. Pure. */
export function blastRadius(item: Pick<ScorableProposal, "op" | "module">): BlastTier {
  const op = item.op ?? "create";
  if (DESTRUCTIVE_OPS.has(op)) return "critical";
  if (PROTECTED_MODULES.has(item.module)) return "elevated";
  return "low";
}

/** confidence bucket → a numeric rank. Unset/unknown is the LEAST confident — never
 *  assume safety from silence; a producer that didn't set confidence gets at least as
 *  much scrutiny as "low" (mirrors review-model's "never faked from score" note on
 *  StagedSummary.confidence). */
const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
function confidenceRank(confidence: string | null | undefined): number {
  if (!confidence) return 0;
  return CONFIDENCE_RANK[confidence] ?? 0;
}

/** The attention score: HIGHER = needs MORE scrutiny (floats to the TOP of the
 *  queue). Blast radius is the dominant term (tier weight, spaced by 10); confidence
 *  only breaks ties WITHIN a tier (0..3, added as `3 - rank` so lower/unset
 *  confidence adds a little more attention even inside the same tier). This is what
 *  guarantees a `delete` (critical, 30-33) ALWAYS outranks a plain update to knowledge
 *  (low, 10-13) — even when the delete is marked "high confidence" and the update is
 *  "low confidence": blast dominates, confidence never overrides it (KTD4's
 *  "destructive floats up regardless of confidence"). Pure — computes a number only. */
export function attentionScore(item: ScorableProposal): number {
  const tier = blastRadius(item);
  const rank = confidenceRank(item.confidence);
  return TIER_WEIGHT[tier] + (3 - rank);
}

/** The safe-tail cutoff: strictly below this score is batchable (the "low" blast tier
 *  only, 10-13, regardless of confidence); at or above it needs scrutiny. Sits in the
 *  gap between the low tier's ceiling (13) and the elevated tier's floor (20), so the
 *  exact value is not fragile — any threshold in (13, 20] draws the same line. */
export const SAFE_TAIL_THRESHOLD = 20;

/** safe-tail (batchable) vs needs-scrutiny — a pure predicate over the score. Other
 *  units (U5 batch, U7 canvas) consume this to decide what's fast-pathable. */
export function isSafeTail(item: ScorableProposal): boolean {
  return attentionScore(item) < SAFE_TAIL_THRESHOLD;
}

export function needsScrutiny(item: ScorableProposal): boolean {
  return !isSafeTail(item);
}

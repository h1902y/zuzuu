// shell/review/ConfidenceMeter.tsx — the scorer's visual (U4): a small meter/badge
// for the attention score computed in score.ts (confidence × blast-radius). Replaces
// the stray, unstyled `item.confidence` muted <Text> line that used to sit in
// ProposalCard.tsx. DISPLAY ONLY (KTD4/the moat) — renders a label + token-bound
// className from a pure variant function and nothing else; it never calls
// approve/reject or touches dataProvider.
//
// Uses the STATUS hues only ("color carries STATE only", index.css) — never the
// proposal hue (ProposalBadge's job: IS this a proposal) or a module hue
// (proposalChip's job: WHAT module this is). Mirrors StatusPill.tsx's plain-span +
// token-class-map shape and ProposalBadge's pure-variant-then-render split.
import { attentionScore, blastRadius, isSafeTail, type BlastTier, type ScorableProposal } from "./score.js";

const TIER_LABEL: Record<BlastTier, string> = {
  critical: "critical",
  elevated: "elevated",
  low: "routine",
};

/** tier → status-hue utility classes (STATE only, never the proposal/module hues). */
const TIER_CLASS: Record<BlastTier, string> = {
  critical: "border-danger text-danger",
  elevated: "border-warning text-warning",
  low: "border-success text-success",
};

export interface ConfidenceMeterVariant {
  /** e.g. "critical · high" — the blast tier + the raw confidence bucket. */
  label: string;
  className: string;
  score: number;
  tier: BlastTier;
  safeTail: boolean;
}

/** Pure item → (label, className, score) — testable without rendering (mirrors
 *  ds/kit/ProposalBadge.tsx's `proposalBadgeVariant`). */
export function confidenceMeterVariant(item: ScorableProposal): ConfidenceMeterVariant {
  const tier = blastRadius(item);
  return {
    label: `${TIER_LABEL[tier]} · ${item.confidence ?? "unscored"}`,
    className: `inline-flex shrink-0 items-center rounded-ui border px-1.5 py-0.5 text-meta font-medium leading-none ${TIER_CLASS[tier]}`,
    score: attentionScore(item),
    tier,
    safeTail: isSafeTail(item),
  };
}

export function ConfidenceMeter({ item }: { item: ScorableProposal }) {
  const v = confidenceMeterVariant(item);
  return <span className={v.className} title={`attention score ${v.score}`}>{v.label}</span>;
}

// ds/kit/ProposalBadge.tsx — the shared "not-yet-real" pill (U1). One canonical
// proposal-state look for every surface that shows a staged change — the palette's
// dashed-warning span, the World's ghost, and the review card's settled chip all
// converge here. Token-bound via proposalRecipe ONLY (no per-surface override,
// mirrors ds/kit/Chip.tsx's shape). `proposalBadgeVariant` is the pure state→
// (label, class) mapping — exported so it's testable without rendering.
import { proposalRecipe, type ProposalState } from "../recipes/proposal.js";

export type { ProposalState };

const DEFAULT_LABEL: Record<ProposalState, string> = {
  pending: "proposal",
  approving: "approved",
  rejecting: "rejected",
};

/** Pure state→(label, className) mapping. `label` overrides the default copy;
 *  the className always comes from the recipe (never a per-call override). */
export function proposalBadgeVariant(state: ProposalState, label?: string): { label: string; className: string } {
  return { label: label ?? DEFAULT_LABEL[state], className: proposalRecipe({ state }) };
}

export function ProposalBadge({ state = "pending", label }: { state?: ProposalState; label?: string }) {
  const v = proposalBadgeVariant(state, label);
  return <span className={v.className}>{v.label}</span>;
}

// ds/recipes/proposal.ts — the proposal-state's token-bound recipe (pure; tested,
// U1). ONE canonical "not-yet-real" visual language for every surface that shows a
// staged change — reconciles the old disagreement (palette: dashed warning-yellow ·
// World: dashed accent-mint · review: a settled solid chip) into a single hue
// (--color-proposal, client/index.css) + a single shared motion set (promoted from
// world/world.css). States: pending (dashed + translucent + pulse), approving
// (solidify pop — snaps to the accent it's becoming), rejecting (dashed, dissolves
// out). twMerge OFF, mirrors ds/recipes/button.ts.
import { tv, type VariantProps } from "tailwind-variants";

const cfg = { twMerge: false } as const;

export const proposalRecipe = tv({
  base: "inline-flex items-center gap-1 rounded-ui border px-1.5 py-0.5 text-meta font-medium leading-none",
  variants: {
    state: {
      // dashed + translucent fill + the shared pulse — "not real yet."
      pending: "border-dashed border-proposal bg-proposal/10 text-proposal animate-proposal-pulse",
      // the solidify pop: border/fill snap to the accent it's becoming (the
      // confirmed/real state), same shared keyframe the World's node solidify uses.
      approving: "border-solid border-accent bg-accent text-on-accent animate-proposal-solidify",
      // stays proposal-dashed while it dissolves out (the shared ghost-out keyframe).
      rejecting: "pointer-events-none border-dashed border-proposal bg-proposal/10 text-proposal animate-proposal-dissolve",
    },
  },
  defaultVariants: { state: "pending" },
}, cfg);

export type ProposalState = NonNullable<VariantProps<typeof proposalRecipe>["state"]>;

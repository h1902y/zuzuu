// ds/recipes/button.ts — the Button's token-bound recipe (pure; tested). The kit's
// sole styling surface: variants over tokens, never inline classes. twMerge OFF.
import { tv } from "tailwind-variants";

const cfg = { twMerge: false } as const;

export const buttonRecipe = tv({
  base: "inline-flex items-center justify-center gap-2 rounded-ui font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus disabled:opacity-50 disabled:pointer-events-none",
  variants: {
    variant: {
      primary: "bg-accent text-ink-950 hover:bg-accent-dim",
      ghost: "text-muted hover:bg-hover hover:text-ink-100",
      outline: "border border-border text-subtle hover:border-accent-dim hover:text-ink-100",
      danger: "text-danger hover:bg-hover",
    },
    size: {
      sm: "h-7 px-2 text-meta",
      md: "h-8 px-3 text-ui",
      lg: "h-9 px-4 text-body",
      icon: "h-8 w-8 px-0",
    },
  },
  defaultVariants: { variant: "ghost", size: "md" },
}, cfg);

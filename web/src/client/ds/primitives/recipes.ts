// ds/primitives/recipes.ts — the layout primitives' token-bound recipes (pure;
// the .tsx wrappers are thin). Every spacing/typography choice is a VARIANT here,
// never an inline class — so the primitives OWN all spacing, and a screen composed
// of them carries zero inline styles. Tested as pure functions (no render needed).
import { tv } from "tailwind-variants";

// twMerge OFF: our variant maps are orthogonal (no class conflicts to dedup), and
// tailwind-merge would mis-group our CUSTOM font-size tokens (text-meta/ui/body)
// against text-* COLORS (text-muted) and drop one. Plain concatenation is correct here.
const cfg = { twMerge: false } as const;

const gap = { none: "gap-0", xs: "gap-1", sm: "gap-2", md: "gap-3", lg: "gap-4", xl: "gap-6" } as const;
const align = { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch", baseline: "items-baseline" } as const;
const justify = { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" } as const;
const pad = { none: "p-0", xs: "p-1", sm: "p-2", md: "p-3", lg: "p-4", xl: "p-6" } as const;

export const boxRecipe = tv({
  base: "",
  variants: {
    pad,
    bg: { app: "bg-app", surface: "bg-surface", elevated: "bg-elevated", hover: "bg-hover", selected: "bg-selected" },
    border: { none: "", hairline: "border border-border", strong: "border border-ink-600" },
    radius: { none: "", sm: "rounded-sm", ui: "rounded-ui", lg: "rounded-lg" },
  },
}, cfg);

export const stackRecipe = tv({
  base: "flex flex-col",
  variants: { gap, align, justify },
  defaultVariants: { gap: "md" },
}, cfg);

export const inlineRecipe = tv({
  base: "flex flex-row",
  variants: { gap, align, justify, wrap: { true: "flex-wrap" } },
  defaultVariants: { gap: "sm", align: "center" },
}, cfg);

export const gridRecipe = tv({
  base: "grid",
  variants: {
    cols: { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" },
    gap,
  },
  defaultVariants: { gap: "md" },
}, cfg);

export const textRecipe = tv({
  base: "",
  variants: {
    size: { meta: "text-meta", ui: "text-ui", body: "text-body" },
    tone: { default: "text-ink-100", muted: "text-muted", subtle: "text-subtle", accent: "text-accent", danger: "text-danger" },
    weight: { normal: "font-normal", medium: "font-medium", semibold: "font-semibold" },
    mono: { true: "font-mono" },
    truncate: { true: "truncate" },
  },
  defaultVariants: { size: "ui", tone: "default" },
}, cfg);

// ds/primitives — Box · Stack · Inline · Grid · Text. The five layout atoms that
// OWN all spacing + typography. The public props deliberately OMIT `className` and
// `style` (KTD4: no prop ⇒ no override) — styling flows only through the token-bound
// recipes. Other native attrs (onClick, aria-*, data-*, ref) pass through.
import type { ElementType, HTMLAttributes, ReactNode } from "react";
import type { VariantProps } from "tailwind-variants";
import { boxRecipe, stackRecipe, inlineRecipe, gridRecipe, textRecipe } from "./recipes.js";

/** Native HTML attributes minus the two style escape-hatches we forbid. */
type Native = Omit<HTMLAttributes<HTMLElement>, "className" | "style">;
type Poly = { as?: ElementType; children?: ReactNode };

export type BoxProps = Native & Poly & VariantProps<typeof boxRecipe>;
export function Box({ as: As = "div", pad, bg, border, radius, children, ...rest }: BoxProps) {
  return <As className={boxRecipe({ pad, bg, border, radius })} {...rest}>{children}</As>;
}

export type StackProps = Native & Poly & VariantProps<typeof stackRecipe>;
export function Stack({ as: As = "div", gap, align, justify, children, ...rest }: StackProps) {
  return <As className={stackRecipe({ gap, align, justify })} {...rest}>{children}</As>;
}

export type InlineProps = Native & Poly & VariantProps<typeof inlineRecipe>;
export function Inline({ as: As = "div", gap, align, justify, wrap, children, ...rest }: InlineProps) {
  return <As className={inlineRecipe({ gap, align, justify, wrap })} {...rest}>{children}</As>;
}

export type GridProps = Native & Poly & VariantProps<typeof gridRecipe>;
export function Grid({ as: As = "div", cols, gap, children, ...rest }: GridProps) {
  return <As className={gridRecipe({ cols, gap })} {...rest}>{children}</As>;
}

export type TextProps = Omit<HTMLAttributes<HTMLElement>, "className" | "style"> & Poly & VariantProps<typeof textRecipe>;
export function Text({ as: As = "span", size, tone, weight, mono, truncate, children, ...rest }: TextProps) {
  return <As className={textRecipe({ size, tone, weight, mono, truncate })} {...rest}>{children}</As>;
}

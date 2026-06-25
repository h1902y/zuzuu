// ds/kit/Button.tsx — the copy-owned kit's Button (shadcn/Radix pattern). `asChild`
// renders the styling onto a child element (Radix Slot) for links/menu items. Styled
// ONLY through buttonRecipe; the public props omit className/style (no override).
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { VariantProps } from "tailwind-variants";
import { buttonRecipe } from "../recipes/button.js";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style">
  & VariantProps<typeof buttonRecipe>
  & { asChild?: boolean; children?: ReactNode };

export function Button({ variant, size, asChild, children, type, ...rest }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={buttonRecipe({ variant, size })} type={asChild ? undefined : (type ?? "button")} {...rest}>
      {children}
    </Comp>
  );
}

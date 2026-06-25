// ds/kit/Icon.tsx — the one icon convention (Lucide, monoline). Inherits the parent's
// text color (currentColor) so tone flows from the surrounding ds Text/recipe; 16px in
// dense rows, 20px for primary. No className escape-hatch (color via the parent, fill
// via the `fill` pass-through) — keeps the zero-inline guard happy.
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export function Icon({ icon: Cmp, size = 16, fill, strokeWidth = 1.5 }: {
  icon: ComponentType<LucideProps>;
  size?: number;
  fill?: string;
  strokeWidth?: number;
}) {
  return <Cmp size={size} strokeWidth={strokeWidth} fill={fill ?? "none"} aria-hidden />;
}

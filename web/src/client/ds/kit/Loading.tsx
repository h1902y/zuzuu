// ds/kit/Loading.tsx — the calm loading + empty states (Notion-calm: a muted line,
// centered, never a spinner-storm). Consolidates the inline "loading…/empty" repeated
// across the Stage+Wings surfaces. Composes a ds primitive; static utilities only.
import type { ReactNode } from "react";
import { Text } from "../primitives/index.js";

export function Loading({ label = "loading…" }: { label?: string }) {
  return <div className="grid h-full place-items-center"><Text tone="muted">{label}</Text></div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid h-full place-items-center px-6 text-center"><Text tone="muted">{children}</Text></div>;
}

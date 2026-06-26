// ds/kit/AppFooter.tsx — the standardised base bar. A calm, low footer with a left
// and a right slot (counts, brand signature, version). Frames a surface top-and-bottom
// with the AppHeader. Composes ds primitives; static, token-bound utilities only.
import type { ReactNode } from "react";

export function AppFooter({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <footer className="flex h-10 shrink-0 items-center justify-between border-t border-border bg-surface px-8">
      <div className="min-w-0">{left}</div>
      <div className="min-w-0">{right}</div>
    </footer>
  );
}

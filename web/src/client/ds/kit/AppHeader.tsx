// ds/kit/AppHeader.tsx — the standardised top app bar. The brand mark is the FIXED
// far-left anchor on every surface; then a `leading` slot (e.g. a project picker), an
// optional page title (display face), and a right-aligned actions slot. One header
// treatment every surface shares — the logo never drifts. Composes ds primitives;
// static, token-bound utilities only (guard-safe).
import type { ReactNode } from "react";
import { Inline, Text } from "../primitives/index.js";
import { Brand } from "./Brand.js";

export function AppHeader({ leading, title, actions }: {
  /** content after the brand (e.g. a project picker). */
  leading?: ReactNode;
  /** the page title — rendered in the display face at app-bar scale. */
  title?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-8">
      <Inline gap="md" align="center">
        <Brand variant="mark" size="md" />
        {leading}
        {title && <Text size="xl" font="display">{title}</Text>}
      </Inline>
      {actions && <Inline gap="md" align="center">{actions}</Inline>}
    </header>
  );
}

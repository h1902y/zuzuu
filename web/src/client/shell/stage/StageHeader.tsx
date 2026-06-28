// shell/stage/StageHeader.tsx — the governed stage-header chrome (P2.1). One header
// above every working stage: the breadcrumb, an optional tab strip (Table·Graph,
// Terminal·Changes — filled by P2.7/P2.8), and the stage's primary action. Thin .tsx;
// stage-header.ts is the tested model. Composes ds primitives + the kit; static
// layout utilities only (no inline styles / arbitrary values).
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { StageTab } from "./stage-header.js";
import { Inline, Text, Icon, Button } from "../../ds/index.js";

interface StageHeaderProps {
  crumb: string[];
  tabs?: StageTab[];
  activeTab?: string;
  onTab?: (key: string) => void;
  primary?: { label: string; icon?: ComponentType<LucideProps>; variant?: "primary" | "outline"; onClick: () => void } | null;
}

export function StageHeader({ crumb, tabs, activeTab, onTab, primary }: StageHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-surface px-6">
      <Inline gap="xs" align="center">
        {crumb.map((seg, i) => (
          <Inline gap="xs" align="center" key={`${seg}-${i}`}>
            {i > 0 && <Icon icon={ChevronRight} size={13} />}
            <Text size="ui" tone={i === crumb.length - 1 ? "default" : "muted"} weight={i === crumb.length - 1 ? "medium" : "normal"} truncate>
              {seg}
            </Text>
          </Inline>
        ))}
      </Inline>

      {tabs && tabs.length > 0 && (
        <Inline gap="xs" align="center">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab?.(t.key)}
              className={`rounded-ui px-3 py-1 text-meta transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus ${t.key === activeTab ? "bg-selected text-ink-100" : "text-subtle hover:bg-hover hover:text-ink-100"}`}
            >
              {t.label}
            </button>
          ))}
        </Inline>
      )}

      <div className="ml-auto" />
      {primary && (
        <Button variant={primary.variant ?? "primary"} size="sm" onClick={primary.onClick}>
          {primary.icon && <Icon icon={primary.icon} size={15} />} {primary.label}
        </Button>
      )}
    </header>
  );
}

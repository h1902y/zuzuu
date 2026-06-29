// ds/kit/EmptyState.tsx — the composed "empty as invitation" state (P2.6). One calm,
// teaching layout (icon · display title · muted hint · optional action) every surface
// shares, replacing ad-hoc one-line empties. Composes ds primitives + Icon; static
// utilities only. The bare `Empty` (a single muted line) stays for trivial slots.
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { Stack, Text } from "../primitives/index.js";
import { Icon } from "./Icon.js";

export function EmptyState({ icon, title, hint, action }: {
  icon?: ComponentType<LucideProps>;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid h-full place-items-center px-8 text-center">
      <Stack gap="sm" align="center">
        {icon && <Icon icon={icon} size={20} />}
        <Text size="lg" font="logo">{title}</Text>
        {hint && <Text size="ui" tone="muted">{hint}</Text>}
        {action}
      </Stack>
    </div>
  );
}

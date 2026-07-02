// shell/HudPill.tsx — the needs-me HUD (§D): the Overview page's composite signal
// (pending proposals + held sessions), relocated onto the map as a persistent
// pill. Click opens the review overlay (the same R). A quiet dot rides it when
// integrity needs a look. Absent entirely when everything is calm — the map
// stays undisturbed.
import { Clock, ShieldAlert } from "lucide-react";
import type { HudModel } from "./overview/overview-model.js";
import { Inline, Text, Icon } from "../ds/index.js";

export function HudPill({ hud, onClick }: { hud: HudModel; onClick: () => void }) {
  if (!hud.show) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-4 top-3 z-30 flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1.5 shadow-overlay transition-colors hover:border-accent-dim hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
    >
      <Inline gap="xs" align="center">
        <Text tone="accent"><Icon icon={Clock} size={12} /></Text>
        <Text size="meta" tone="default">{hud.label}</Text>
        {hud.integrity && <Text tone="accent"><Icon icon={ShieldAlert} size={12} /></Text>}
      </Inline>
    </button>
  );
}

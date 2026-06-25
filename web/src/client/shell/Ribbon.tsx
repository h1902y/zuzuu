// shell/Ribbon.tsx — the always-on footer ribbon: the ambient gate (R5). Live-session
// count + total pending + R-to-review; a calm "all caught up" empty state. Composed
// from ds primitives + Lucide icons; the layout frame uses static utilities.
import { Circle, Clock, Check } from "lucide-react";
import { ribbonState, type SessionLite } from "./shell-state.js";
import { Inline, Text, Icon } from "../ds/index.js";

export function Ribbon({
  sessions, pendingByModule, onReview, setupHint,
}: { sessions: SessionLite[]; pendingByModule: Record<string, number>; onReview?: () => void; setupHint?: string }) {
  const r = ribbonState(sessions, pendingByModule);
  const liveTone = setupHint ? "subtle" : r.liveness ? "accent" : "muted";
  const pendTone = r.pending ? "default" : "muted";
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-t border-border bg-app px-5">
      <Inline gap="sm">
        <Inline gap="xs">
          <Text tone={liveTone}><Icon icon={Circle} size={11} fill={r.liveness && !setupHint ? "currentColor" : "none"} /></Text>
          <Text size="meta" tone={liveTone}>{setupHint ? setupHint : r.liveness ? `${r.liveness} live` : "idle"}</Text>
        </Inline>
        <Text size="meta" tone="muted">·</Text>
        <Inline gap="xs">
          <Text tone={pendTone}><Icon icon={r.allCaughtUp ? Check : Clock} size={11} /></Text>
          <Text size="meta" tone={pendTone}>{r.allCaughtUp ? "all caught up" : `${r.pending} pending`}</Text>
        </Inline>
      </Inline>
      {!r.allCaughtUp && onReview && (
        <Text as="button" interactive size="meta" tone="accent" onClick={onReview}>press R to review</Text>
      )}
    </div>
  );
}

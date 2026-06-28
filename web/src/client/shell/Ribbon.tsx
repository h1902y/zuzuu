// shell/Ribbon.tsx — the project page's footer: the always-on ambient gate (R5).
// Live-session count + total pending + R-to-review; a calm "all caught up" state. It
// composes the SAME standardised AppFooter as the Projects Home, so the footer bar is
// consistent across both surfaces — only the slot content differs.
import { Circle, Clock, Check } from "lucide-react";
import { ribbonState, type SessionLite } from "./shell-state.js";
import { Inline, Text, Icon, AppFooter } from "../ds/index.js";

export function Ribbon({
  sessions, pendingByModule, onReview, setupHint,
}: { sessions: SessionLite[]; pendingByModule: Record<string, number>; onReview?: () => void; setupHint?: string }) {
  const r = ribbonState(sessions, pendingByModule);
  const liveTone = setupHint ? "subtle" : r.liveness ? "accent" : "muted";
  const pendTone = r.pending ? "default" : "muted";
  return (
    <AppFooter
      left={
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
      }
      right={
        !r.allCaughtUp && onReview
          ? <Text as="button" interactive size="meta" tone="accent" onClick={onReview}>press R to review</Text>
          : undefined
      }
    />
  );
}

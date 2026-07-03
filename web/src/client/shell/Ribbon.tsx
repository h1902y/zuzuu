// shell/Ribbon.tsx — the project page's footer: the always-on ambient gate (R5).
// Live-session count + total pending + R-to-review; a calm "all caught up" state.
// RIGHT edge: review nudge + the settings gear (a dialog). The projection toggle +
// globe moved UP to the top app header (one always-visible instance). Composes the
// SAME standardised AppFooter as the global page.
import { Circle, Clock, Check, Settings as SettingsIcon } from "lucide-react";
import { ribbonState, type SessionLite } from "./shell-state.js";
import { Inline, Text, Icon, AppFooter } from "../ds/index.js";

export function Ribbon({
  sessions, pendingByModule, onReview, setupHint, onSettings,
}: {
  sessions: SessionLite[]; pendingByModule: Record<string, number>; onReview?: () => void;
  setupHint?: string; onSettings?: () => void;
}) {
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
        <Inline gap="sm" align="center">
          {!r.allCaughtUp && onReview && (
            <Text as="button" interactive size="meta" tone="accent" onClick={onReview}>press R to review</Text>
          )}
          {/* §D — the quiet settings affordance at the footer's RIGHT edge (a dialog;
              the canvas never disturbed) */}
          {onSettings && (
            <Text as="button" interactive size="meta" tone="muted" onClick={onSettings} aria-label="settings">
              <Icon icon={SettingsIcon} size={13} />
            </Text>
          )}
        </Inline>
      }
    />
  );
}

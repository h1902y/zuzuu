// shell/Ribbon.tsx — the project page's footer: the always-on ambient gate (R5).
// LEFT edge: the persistent PROJECTION SWITCHER ([Map · Table] + the Globe) — the
// always-there twin of the stage-header's in-context control, so toggling views is
// never keyboard-only (T · >map/>table stay as the power paths). Then live-session
// count + total pending + R-to-review; a calm "all caught up" state. RIGHT edge:
// review nudge + the settings gear (a dialog). Composes the SAME standardised
// AppFooter as the Projects Home.
import { Circle, Clock, Check, Orbit, Settings as SettingsIcon } from "lucide-react";
import { ribbonState, type SessionLite } from "./shell-state.js";
import type { ProjectionSwitch, ProjTarget } from "./projection-switch.js";
import { Inline, Text, Icon, AppFooter } from "../ds/index.js";

export function Ribbon({
  sessions, pendingByModule, onReview, setupHint, onSettings, projection, onProject, onGlobe,
}: {
  sessions: SessionLite[]; pendingByModule: Record<string, number>; onReview?: () => void;
  setupHint?: string; onSettings?: () => void;
  projection?: ProjectionSwitch; onProject?: (t: ProjTarget) => void; onGlobe?: () => void;
}) {
  const r = ribbonState(sessions, pendingByModule);
  const liveTone = setupHint ? "subtle" : r.liveness ? "accent" : "muted";
  const pendTone = r.pending ? "default" : "muted";
  return (
    <AppFooter
      left={
        <Inline gap="md" align="center">
          {projection && onProject && (
            // the segmented projection switcher — active-state aware, on EVERY stage.
            // Map ⇄ Table (T · >map/>table); Globe = the global page (all projects).
            <Inline gap="sm" align="center">
              <div className="flex items-center overflow-hidden rounded-ui border border-border">
                <button
                  type="button"
                  onClick={() => onProject(projection.map)}
                  aria-pressed={projection.active === "map"}
                  title="Map — the World (T · >map)"
                  className={`px-2 py-0.5 text-meta transition-colors ${projection.active === "map" ? "bg-hover text-ink-100" : "text-muted hover:text-ink-100"}`}
                >
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => onProject(projection.table)}
                  aria-pressed={projection.active === "table"}
                  title="Table (T · >table)"
                  className={`border-l border-border px-2 py-0.5 text-meta transition-colors ${projection.active === "table" ? "bg-hover text-ink-100" : "text-muted hover:text-ink-100"}`}
                >
                  Table
                </button>
              </div>
              {onGlobe && (
                <Text as="button" interactive tone="muted" onClick={onGlobe} aria-label="all projects" title="All projects — the globe">
                  <Icon icon={Orbit} size={14} />
                </Text>
              )}
            </Inline>
          )}
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

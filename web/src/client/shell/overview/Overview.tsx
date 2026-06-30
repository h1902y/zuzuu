// shell/overview/Overview.tsx — the Project home (slimmed, U6). The SESSIONS / THE BRAIN
// columns were a second copy of the sidebar (problem #3) and are removed. What remains is
// the non-duplicated surface: identity · the brain-health row (the check-verb stats —
// notes · tables · pending · protected · last-activity) · the quick actions. The
// activity/review stream that would replace the columns is a deferred decision (§4.2),
// not built here. Thin .tsx; overview-model is the tested logic; composes from ds primitives.
import type { ReactNode } from "react";
import type { ModuleOverviewEntry, SessionInfo } from "#shared/index.js";
import { Database, Table2, Clock, Shield, Plus, Circle, ListChecks } from "lucide-react";
import { brainSummary, lastSessionActivity } from "./overview-model.js";
import { relativeTime } from "../projects/projects-model.js";
import { Stack, Inline, Text, Icon, Button } from "../../ds/index.js";

interface OverviewProps {
  name: string;
  /** the project's identity emoji (the same one in the header) — its title glyph. */
  emoji?: string;
  path: string;
  enabled: boolean;
  modules: ModuleOverviewEntry[];
  sessions: SessionInfo[];
  onStartSession: () => void;
  onReview: () => void;
  /** U5 — the onboarding companion block (consent narration / host picker), rendered
   *  above identity while setup is incomplete; undefined once steady. */
  companion?: ReactNode;
  /** U5 — invite the first session in place (prepped + no session yet). */
  segue?: boolean;
}

export function Overview(props: OverviewProps) {
  const { name, emoji, path, enabled, modules, sessions, onStartSession, onReview, companion, segue } = props;
  const health = brainSummary(modules);
  const now = Date.now();
  const lastActive = lastSessionActivity(sessions);

  return (
    <div className="h-full overflow-y-auto px-10 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <Stack gap="xl">
          {/* U5 — onboarding composes IN here (above identity) while setup is incomplete,
              so the last rung recedes in place rather than snapping to the dashboard. */}
          {companion}
          {/* identity — the project's own emoji is its title glyph (matches the header) */}
          <Stack gap="sm">
            <Inline gap="sm" align="center">
              {emoji ? <Text size="2xl">{emoji}</Text> : <Icon icon={Database} size={20} />}
              <Text size="2xl" font="display">{name}</Text>
            </Inline>
            <Text size="meta" tone="muted" truncate>{path}</Text>
          </Stack>

          {/* brain-health row — the one non-duplicated surface, retained (R9 guardrail):
              broken/orphan/stale integrity is what keeps the gated brain trustworthy. */}
          <Inline gap="xl" wrap>
            <Stat icon={ListChecks} label={health.notes === 1 ? "note" : "notes"} value={String(health.notes)} />
            <Stat icon={Table2} label={health.tables === 1 ? "table" : "tables"} value={String(health.tables)} />
            <Stat icon={Clock} label="pending review" value={String(health.pending)} accent={health.pending > 0} />
            <Stat icon={Shield} label={enabled ? "protected" : "not enabled"} value="" />
            <Stat icon={Circle} label="last activity" value={lastActive ? relativeTime(lastActive, now) : "never"} />
          </Inline>

          {/* U5 — the in-place segue: prepped, brain empty, no session yet */}
          {segue && !companion && (
            <Text size="ui" tone="muted">You're all set — start your first session below.</Text>
          )}
          {/* quick actions */}
          <Inline gap="sm">
            <Button variant="primary" size="sm" onClick={onStartSession}><Icon icon={Plus} size={15} /> Start a session</Button>
            {health.pending > 0 && (
              <Button variant="outline" size="sm" onClick={onReview}><Icon icon={Clock} size={14} /> Review {health.pending}</Button>
            )}
          </Inline>
        </Stack>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: typeof Database; label: string; value: string; accent?: boolean }) {
  return (
    <Inline gap="sm" align="center">
      <Icon icon={icon} size={16} />
      <Stack gap="none">
        {value && <Text size="body" weight="medium" tone={accent ? "accent" : "default"}>{value}</Text>}
        <Text size="meta" tone="muted">{label}</Text>
      </Stack>
    </Inline>
  );
}

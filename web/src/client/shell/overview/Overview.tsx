// shell/overview/Overview.tsx — the "what needs me" home (§4.2). Leads with what needs
// the user (pending brain proposals + sessions held at the merge gate), the top items
// inline (→ the review queue), dual-primary (Review + Start-a-session both prominent —
// never a review-only chore-list). The onboarding companion composes IN ADDITIVELY: the
// identity + ambient strip + actions still render during setup; only the review-hero is
// suppressed (homeModel `showReview` is false while onboarding). Thin .tsx — homeModel /
// brainSummary are the tested logic; the pending items come from use-review-queue.
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ModuleOverviewEntry, SessionInfo, StagedSummary } from "#shared/index.js";
import { Database, Table2, Clock, Shield, ShieldAlert, Plus, Circle, ListChecks, Inbox } from "lucide-react";
import { api } from "../../lib/api.js";
import { useReviewQueue } from "../review/use-review-queue.js";
import { brainSummary, lastSessionActivity, homeModel } from "./overview-model.js";
import { relativeTime } from "../projects/projects-model.js";
import { Stack, Inline, Text, Icon, Button } from "../../ds/index.js";

const PENDING_CAP = 5;

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
  /** the onboarding companion block; rendered additively above the chrome while setup
   *  is incomplete (its presence ⇒ homeModel lead "setup" ⇒ review-hero suppressed). */
  companion?: ReactNode;
  /** legacy — the first-session segue is now homeModel's "first" copy; kept for compat. */
  segue?: boolean;
}

export function Overview(props: OverviewProps) {
  const { name, emoji, path, enabled, modules, sessions, onStartSession, onReview, companion } = props;
  const health = brainSummary(modules);
  const now = Date.now();
  const lastActive = lastSessionActivity(sessions);
  // held sessions awaiting a merge decision — the OTHER thing that needs the user (PL-1).
  const held = useQuery({ queryKey: ["zuzuu", "held"], queryFn: api.zuzuu.held });
  const heldCount = held.data?.held?.length ?? 0;
  const review = useReviewQueue();

  const home = homeModel({
    pendingCount: health.pending,
    heldCount,
    sessionCount: sessions.length,
    setupIncomplete: !!companion,
  });
  const topPending = review.queue.slice(0, PENDING_CAP);
  const moreCount = Math.max(0, review.total - topPending.length);

  return (
    <div className="h-full overflow-y-auto px-10 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <Stack gap="xl">
          {/* onboarding composes IN here — ADDITIVE: the chrome below still renders (R6) */}
          {companion}

          {/* identity — the project's own emoji is its title glyph (matches the header) */}
          <Stack gap="sm">
            <Inline gap="sm" align="center">
              {emoji ? <Text size="2xl">{emoji}</Text> : <Icon icon={Database} size={20} />}
              <Text size="2xl" font="display">{name}</Text>
            </Inline>
            <Text size="meta" tone="muted" truncate>{path}</Text>
          </Stack>

          {/* ambient strip — quiet facts; the actionable pending is pulled OUT into the
              lead block. The brain-integrity signal (broken/orphan/stale) stays visible. */}
          <Inline gap="xl" wrap>
            <Stat icon={ListChecks} label={health.notes === 1 ? "note" : "notes"} value={String(health.notes)} />
            <Stat icon={Table2} label={health.tables === 1 ? "table" : "tables"} value={String(health.tables)} />
            <Stat
              icon={health.integrity > 0 ? ShieldAlert : Shield}
              label={health.integrity > 0 ? "need attention" : enabled ? "protected" : "not enabled"}
              value={health.integrity > 0 ? String(health.integrity) : ""}
              accent={health.integrity > 0}
            />
            <Stat icon={Circle} label="last activity" value={lastActive ? relativeTime(lastActive, now) : "no activity yet"} />
          </Inline>

          {/* the lead block — dual-primary; the review-hero + pending list only when
              something needs the user (and not during setup). */}
          <Stack gap="md">
            {home.showReview ? (
              <>
                <Inline gap="sm" align="center">
                  <Icon icon={Inbox} size={16} />
                  <Text size="base" weight="medium">{home.copy}</Text>
                </Inline>
                <PendingList items={topPending} more={moreCount} loading={review.loading} onOpen={onReview} />
              </>
            ) : home.copy ? (
              <Text size="ui" tone="muted">{home.copy}</Text>
            ) : null}

            <Inline gap="sm">
              {home.showReview && (
                <Button variant="primary" size="sm" onClick={onReview}>
                  <Icon icon={Clock} size={14} /> Review {home.needsMeCount}
                </Button>
              )}
              <Button variant={home.showReview ? "outline" : "primary"} size="sm" onClick={onStartSession}>
                <Icon icon={Plus} size={15} /> Start a session
              </Button>
            </Inline>
          </Stack>
        </Stack>
      </div>
    </div>
  );
}

/** The top pending proposals inline on the home; each row (and "+N more") opens the
 *  review queue (no per-item focus in v1). A skeleton fills the row area while the
 *  cross-module staged fetch resolves, so the hero doesn't sit above an empty gap. */
function PendingList({ items, more, loading, onOpen }: {
  items: StagedSummary[]; more: number; loading: boolean; onOpen: () => void;
}) {
  if (loading && !items.length) {
    return (
      <Stack gap="xs">
        {[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-ui bg-hover" />)}
      </Stack>
    );
  }
  return (
    <Stack gap="xs">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-3 rounded-ui border border-border px-3 py-2 text-left transition-colors hover:border-accent-dim hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
        >
          <span className="min-w-0 flex-1 truncate text-ui text-ink-100">{it.title}</span>
          {it.preview && <span className="hidden min-w-0 flex-1 truncate text-meta text-muted sm:block">{it.preview}</span>}
          <Text size="meta" tone="muted">{it.module}</Text>
        </button>
      ))}
      {more > 0 && (
        <Text as="button" interactive size="meta" tone="muted" onClick={onOpen}>+ {more} more → review all</Text>
      )}
    </Stack>
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

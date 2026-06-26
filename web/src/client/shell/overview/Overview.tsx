// shell/overview/Overview.tsx — the Project Overview (the balanced home base, P1.5).
// Lands on entering a project (and reachable via the ⌂ Overview nav node). Identity
// (display title + path + enabled/notes) · a health row · two BALANCED columns —
// SESSIONS (live/recent + start) ⇄ THE BRAIN (tables at a glance + open) · quick
// actions (Start session · Review N). Thin .tsx; overview-model is the tested logic;
// composes from ds primitives, static utilities only.
import type { ModuleOverviewEntry, SessionInfo } from "#shared/index.js";
import { Database, Table2, Clock, Shield, Plus, Terminal, Bot, Circle, ListChecks } from "lucide-react";
import { brainSummary, sessionCards, lastSessionActivity } from "./overview-model.js";
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
  onPickModule: (id: string) => void;
  onPickSession: (id: string) => void;
  onStartSession: () => void;
  onReview: () => void;
}

export function Overview(props: OverviewProps) {
  const { name, emoji, path, enabled, modules, sessions, onPickModule, onPickSession, onStartSession, onReview } = props;
  const health = brainSummary(modules);
  const cards = sessionCards(sessions);
  const now = Date.now();
  const lastActive = lastSessionActivity(sessions);

  return (
    <div className="h-full overflow-y-auto px-10 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <Stack gap="xl">
          {/* identity — the project's own emoji is its title glyph (matches the header) */}
          <Stack gap="sm">
            <Inline gap="sm" align="center">
              {emoji ? <Text size="2xl">{emoji}</Text> : <Icon icon={Database} size={20} />}
              <Text size="2xl" font="display">{name}</Text>
            </Inline>
            <Text size="meta" tone="muted" truncate>{path}</Text>
          </Stack>

          {/* health row */}
          <Inline gap="xl" wrap>
            <Stat icon={ListChecks} label={health.notes === 1 ? "note" : "notes"} value={String(health.notes)} />
            <Stat icon={Table2} label={health.tables === 1 ? "table" : "tables"} value={String(health.tables)} />
            <Stat icon={Clock} label="pending review" value={String(health.pending)} accent={health.pending > 0} />
            <Stat icon={Shield} label={enabled ? "protected" : "not enabled"} value="" />
            <Stat icon={Circle} label="last activity" value={lastActive ? relativeTime(lastActive, now) : "never"} />
          </Inline>

          {/* quick actions */}
          <Inline gap="sm">
            <Button variant="primary" size="sm" onClick={onStartSession}><Icon icon={Plus} size={15} /> Start a session</Button>
            {health.pending > 0 && (
              <Button variant="outline" size="sm" onClick={onReview}><Icon icon={Clock} size={14} /> Review {health.pending}</Button>
            )}
          </Inline>

          {/* two balanced columns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* SESSIONS — no "+ new" here: the primary "Start a session" above is the
                single CTA (the column header was a redundant third way to start one). */}
            <Stack gap="sm">
              <Text size="meta" tone="subtle" weight="semibold">SESSIONS</Text>
              <Stack gap="xs">
                {cards.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onPickSession(s.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-ui border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
                  >
                    <Inline gap="sm">
                      <Icon icon={s.type === "agent" ? Bot : Terminal} size={15} />
                      <Text size="ui" truncate>{s.title}</Text>
                    </Inline>
                    {s.live && <Text size="meta" tone="accent">live</Text>}
                  </button>
                ))}
                {!cards.length && (
                  <div className="rounded-ui border border-border bg-surface px-4 py-6 text-center">
                    <Text size="ui" tone="muted">No sessions yet — zuzuu watches each one and grows the brain from it.</Text>
                  </div>
                )}
              </Stack>
            </Stack>

            {/* THE BRAIN */}
            <Stack gap="sm">
              <Text size="meta" tone="subtle" weight="semibold">THE BRAIN</Text>
              <Stack gap="xs">
                {modules.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onPickModule(m.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-ui border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
                  >
                    <Inline gap="sm"><Icon icon={Table2} size={15} /><Text size="ui" truncate>{m.title}</Text></Inline>
                    <Inline gap="md">
                      <Text size="meta" tone="muted">{m.counts?.items ?? 0} rows</Text>
                      {m.counts?.pending ? (
                        <Inline gap="xs"><Icon icon={Clock} size={12} /><Text size="meta" tone="accent">{m.counts.pending}</Text></Inline>
                      ) : null}
                    </Inline>
                  </button>
                ))}
                {!modules.length && (
                  <div className="rounded-ui border border-border bg-surface px-4 py-6 text-center">
                    <Text size="ui" tone="muted">No tables yet — zuzuu grows them as you work.</Text>
                  </div>
                )}
              </Stack>
            </Stack>
          </div>
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

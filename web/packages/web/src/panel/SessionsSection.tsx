// §2 Sessions — the ACTIVE session pinned at top (resumes its live terminal
// when the workbench owns it; otherwise honestly says it's running outside),
// and all past runs collapsed into ONE "Session history" card (expand to see
// the recency-bucketed list). Status is the only color; ids/durations mono.
import { useState } from "react";
import type { ZuzuuSessionEntry } from "@zuzuu-web/protocol";
import { useQuery } from "@tanstack/react-query";
import { zuzuuApi } from "../lib/zuzuu-api";
import { Count, InfoDot, StatusPill, cx } from "../components/ui";
import { useRightPanel } from "../state/right-panel";
import { useSessions } from "../state/sessions";
import { agentTabTitle } from "../modules/host-launch";
import { TeachingEmpty, relativeTime, GLOSSARY } from "./kit";
import { SessionBrief } from "./SessionBrief";
import { fmtDuration, sessionStateMeta, shortSessionId, splitSessions } from "./sections";

// ── sessions empty-state preview mock ────────────────────────────────────────

/** Faint mock rows that preview what the sessions list will look like once
 *  the first session is captured. Pointer-events-none is set by TeachingEmpty's
 *  preview wrapper; these are purely decorative. */
function SessionsPreviewMock() {
  const rows = [
    { state: "completed", host: "claude code", ago: "2m ago", dur: "12.3m", id: "a1b2c3d4" },
    { state: "captured",  host: "gemini cli",  ago: "1h ago", dur: "8.7m",  id: "e5f6g7h8" },
    { state: "captured",  host: "claude code", ago: "3h ago", dur: "22.1m", id: "i9j0k1l2" },
  ] as const;
  const toneCls: Record<string, string> = {
    completed: "text-ok border-ok/40 bg-[color-mix(in_oklab,var(--color-ok)_10%,transparent)]",
    captured:  "text-muted-foreground border-[var(--border)] bg-card",
  };
  return (
    <div className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-ui)] border border-[var(--border)]">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2 px-2 py-1.5">
          <span className={cx("wc-sans inline-flex items-center rounded px-1.5 py-0.5 text-meta font-medium border", toneCls[r.state])}>
            {r.state}
          </span>
          <span className="wc-sans min-w-0 flex-1 truncate text-ui font-medium text-foreground">{r.host}</span>
          <span className="flex shrink-0 items-baseline gap-3 text-meta text-muted-foreground">
            <span className="wc-sans">{r.ago}</span>
            <span className="wc-mono">{r.dur}</span>
            <span className="wc-mono text-muted-foreground">{r.id}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── recency bucketing ─────────────────────────────────────────────────────

type Bucket = "Today" | "Yesterday" | "This week" | "Older";

function recencyBucket(iso: string | null | undefined): Bucket {
  if (!iso) return "Older";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "Older";
  const age = Date.now() - t;
  const day = 86_400_000;
  if (age < day) return "Today";
  if (age < 2 * day) return "Yesterday";
  if (age < 7 * day) return "This week";
  return "Older";
}

function bucketSessions(sessions: ZuzuuSessionEntry[]): { bucket: Bucket; items: ZuzuuSessionEntry[] }[] {
  const order: Bucket[] = ["Today", "Yesterday", "This week", "Older"];
  const map = new Map<Bucket, ZuzuuSessionEntry[]>();
  for (const s of sessions) {
    const b = recencyBucket(s.startedAt);
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(s);
  }
  return order.filter((b) => map.has(b)).map((b) => ({ bucket: b, items: map.get(b)! }));
}

// ── status pill mapping ───────────────────────────────────────────────────

function statusTone(tone: string): "ok" | "warn" | "bad" | "neutral" | "info" {
  if (tone === "ok") return "ok";
  if (tone === "warn") return "warn";
  if (tone === "danger") return "bad";
  return "neutral";
}

// ── a single session row (compact data table row) ─────────────────────────

function SessionRow({ session }: { session: ZuzuuSessionEntry }) {
  const openSession = useRightPanel((s) => s.openSession);
  const meta = sessionStateMeta(session.state);
  const dur = fmtDuration(session.durationMs);
  const when = relativeTime(session.startedAt ?? undefined);
  const isCrashed = session.state === "crashed";

  return (
    <button
      onClick={() => openSession(session.id)}
      className={cx(
        "group flex w-full items-center gap-2 border-b border-[var(--border)] py-1.5 pl-2 pr-2 text-left transition-colors last:border-0 hover:bg-[var(--accent)]",
        isCrashed && "bg-[var(--color-error-subtle)] hover:bg-[color-mix(in_oklab,var(--color-error-subtle)_80%,var(--color-hover))]",
      )}
      title={`Inspect session ${session.id}`}
    >
      <StatusPill tone={statusTone(meta.tone)}>{meta.label}</StatusPill>
      <span className="wc-sans min-w-0 flex-1 truncate text-ui font-medium text-foreground">
        {session.host ?? "session"}
      </span>
      <span className="flex shrink-0 items-baseline gap-3 text-meta text-muted-foreground">
        {when && <span className="wc-sans">{when}</span>}
        {dur && <span className="wc-mono">{dur}</span>}
        <span className="wc-mono text-muted-foreground">{shortSessionId(session.id)}</span>
      </span>
    </button>
  );
}

// ── pinned active session card ─────────────────────────────────────────────

/** The active session pins at top. If the workbench owns a live agent terminal
 *  (single-active-agent rule → at most one), the card resumes THAT terminal.
 *  Otherwise the session is running outside the workbench (e.g. the user's own
 *  Claude Code) — we say so honestly rather than imply a resume we can't do. */
function ActiveCard({ session }: { session: ZuzuuSessionEntry }) {
  const openSession = useRightPanel((s) => s.openSession);
  // Prefer the explicit PTY join key (U4): when the trace record carries the
  // daemon PTY id, resolve the live terminal by that id rather than guessing
  // "the one alive agent tab" by cwd/type. Fall back to the old guess for
  // pre-U4 records that lack ptyId. (U5 rewrites this band; this only makes the
  // explicit link available.)
  const liveAgent = useSessions((s) =>
    (session.ptyId && s.tabs.find((t) => t.id === session.ptyId && t.alive)) ||
    s.tabs.find((t) => t.type === "agent" && t.alive),
  );
  const setActive = useSessions((s) => s.setActive);
  const meta = sessionStateMeta(session.state);
  const dur = fmtDuration(session.durationMs);

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-ui)] border border-[var(--border)] bg-card px-2 pb-2.5 pt-1.5">
      <div className="flex w-full items-center gap-2">
        <StatusPill tone="ok">{meta.label}</StatusPill>
        <span className="wc-sans min-w-0 flex-1 truncate text-ui font-medium text-foreground">
          {session.host ?? "session"}
        </span>
        <span className="flex shrink-0 items-baseline gap-3 text-meta text-muted-foreground">
          {dur && <span className="wc-mono">{dur}</span>}
          <span className="wc-mono text-muted-foreground">{shortSessionId(session.id)}</span>
        </span>
      </div>

      {liveAgent ? (
        <button
          onClick={() => setActive(liveAgent.id)}
          className="wc-sans flex items-center gap-1.5 self-start rounded-[var(--radius-sm)] border border-accent-dim bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] px-2 py-1 text-meta font-medium text-accent transition-colors hover:bg-[color-mix(in_oklab,var(--color-accent)_20%,transparent)]"
          title="Focus this session's terminal"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4l3.5 4L3 12M8.5 12H13" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Open terminal
        </button>
      ) : (
        <div className="wc-sans flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-meta text-muted-foreground">
          <span>Running in {agentTabTitle(session.host)} — outside the workbench.</span>
          <button onClick={() => openSession(session.id)} className="text-muted-foreground transition-colors hover:text-foreground">Inspect ›</button>
        </div>
      )}

      <SessionBrief />
    </div>
  );
}

// ── collapsed session-history card ─────────────────────────────────────────

function SessionHistory({ rest }: { rest: ZuzuuSessionEntry[] }) {
  const [open, setOpen] = useState(false);
  const buckets = bucketSessions(rest);

  if (rest.length === 0) {
    return <div className="px-2 py-1 text-meta text-muted-foreground">No past sessions yet.</div>;
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--accent)]"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 2.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11M8 5v3.2l2.2 1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="wc-sans text-ui font-medium text-foreground">Session history</span>
        <Count>{rest.length}</Count>
        <InfoDot title={GLOSSARY.session!.term}>{GLOSSARY.session!.what}</InfoDot>
        <svg viewBox="0 0 16 16" className={cx("ml-auto h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <div className="mt-1 flex flex-col gap-1">
          {buckets.map(({ bucket, items }) => (
            <div key={bucket}>
              <div className="wc-sans pb-0.5 pt-2 text-meta font-medium text-muted-foreground first:pt-0">{bucket}</div>
              <div className="flex flex-col overflow-hidden rounded-[var(--radius-ui)] border border-[var(--border)]">
                {items.map((s) => <SessionRow key={s.id} session={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────

export function SessionsSection() {
  const q = useQuery({ queryKey: ["zuzuu", "sessions"], queryFn: zuzuuApi.sessions, refetchInterval: 6000 });
  const all = q.data?.sessions ?? [];
  const { active, rest } = splitSessions(all);

  if (all.length === 0) {
    const sessionsDisplay = {
      label: "Sessions",
      icon: "M8 2.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11M8 5v3.2l2.2 1.6",
      emptyHeadline: "Your agent hasn't run yet",
      teach: "Start a session and zuzuu watches over its shoulder — every run becomes something it can learn from.",
    };
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <span className="wc-eyebrow">sessions</span>
          <InfoDot title={GLOSSARY.session!.term}>{GLOSSARY.session!.what}</InfoDot>
        </div>
        <TeachingEmpty display={sessionsDisplay} preview={<SessionsPreviewMock />} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {active && <ActiveCard session={active} />}
      <SessionHistory rest={rest} />
    </div>
  );
}

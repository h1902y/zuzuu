// The single-focus center (T3 + T4) — built on "a session is a tree".
//
// ONE focus collapses the old competing surfaces (tab strip, conversation
// header, active band, 40% history block, detail page, recovery modal) into:
//
//   [slim session picker] +
//   [SessionTree | Terminal tabs for the selected session] +
//   [one composer] +
//   [one inline recovery banner when a leftover session exists]
//
// The slim picker (T3) lists sessions active/now → recent → older; selecting a
// row sets which session the center VIEWS. A LIVE session (a workbench PTY is
// attached, resolved by the U4 ptyId join key) streams — its terminal tab is the
// live surface and its tree grows; a PAST session renders the SessionTree
// statically from its trace, with no terminal tab.
//
// PTY hot path is untouched: every live PTY tab keeps an always-mounted TermView
// (visibility toggle, never unmounted) so the WebSocket / flow-control survive
// switching the viewed session.
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ZuzuuSessionEntry } from "@zuzuu-web/protocol";
import { useSessions } from "../state/sessions";
import { mergeSessionWithFallback, refreshSessionGit } from "../lib/session-git-actions";
import { describeZuzuuError } from "../lib/zuzuu-api";
import { TermView } from "../term/TermView";
import { SessionTree } from "../term/SessionTree";
import { Bar, Tab, TabBar, StatusDot, StatusPill, cx } from "../components/ui";
import { RecoveryBanner, SetupZuzuuCard } from "../components/SessionCards";
import { SessionComposer } from "../components/SessionComposer";
import { centerCard } from "../lib/session-cards";
import { sessionStateMeta, shortSessionId, fmtDuration } from "../panel/sections";
import { relativeTime } from "../panel/kit";
import { agentTabTitle } from "../modules/host-launch";
import { pickerRows, resolveViewed, type PickerRow } from "./session-picker";
import { useSessionGitQuery, useZuzuuHealthQuery } from "./queries";
import { zuzuuApi } from "../lib/zuzuu-api";

/** Which sub-surface of the viewed session is showing. */
type WorkTab = "tree" | "terminal";

function pillTone(tone: string): "ok" | "warn" | "bad" | "neutral" {
  if (tone === "ok") return "ok";
  if (tone === "warn") return "warn";
  if (tone === "danger") return "bad";
  return "neutral";
}

// ── the slim session picker (T3) ──────────────────────────────────────────
// A compact horizontal strip of session rows: status pill · host · relative
// time · duration. Live rows pulse; the "running outside the workbench" state
// reads quietly here (a row note), never a separate persistent band.

function PickerRowButton({
  row,
  active,
  onSelect,
}: {
  row: PickerRow;
  active: boolean;
  onSelect: () => void;
}) {
  const s = row.session;
  const meta = sessionStateMeta(s.state);
  const when = relativeTime(s.startedAt ?? undefined);
  const dur = fmtDuration(s.durationMs);
  // "running outside the workbench": a live-state trace with no workbench PTY.
  const outside = !row.live && (s.state === "active" || s.state === "opening");
  return (
    <button
      onClick={onSelect}
      title={`View session ${s.id}`}
      className={cx(
        "group flex shrink-0 items-center gap-2 rounded-[var(--radius-ui)] border px-2 py-1 text-left transition-colors",
        active
          ? "border-[var(--border)] bg-[var(--accent)]"
          : "border-transparent hover:border-[var(--border)] hover:bg-[var(--accent)]",
      )}
    >
      {row.live ? (
        <StatusDot tone="ok" pulse />
      ) : (
        <StatusPill tone={pillTone(meta.tone)}>{meta.label}</StatusPill>
      )}
      <span className="wc-sans max-w-[12rem] truncate text-ui font-medium text-foreground">
        {agentTabTitle(s.host) || s.host || "session"}
      </span>
      {outside && (
        <span className="wc-sans shrink-0 text-meta text-muted-foreground" title="Running outside the workbench">
          · outside
        </span>
      )}
      <span className="flex shrink-0 items-baseline gap-2 text-meta text-muted-foreground">
        {when && <span className="wc-sans">{when}</span>}
        {dur && <span className="wc-mono">{dur}</span>}
      </span>
    </button>
  );
}

function SessionPicker({
  rows,
  viewedId,
  onSelect,
}: {
  rows: PickerRow[];
  viewedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <Bar border="b" surface="surface" className="!h-auto !min-h-[var(--height-bar)] gap-1.5 overflow-x-auto !px-2 py-1.5">
      {rows.map((row) => (
        <PickerRowButton
          key={row.session.id}
          row={row}
          active={row.session.id === viewedId}
          onSelect={() => onSelect(row.session.id)}
        />
      ))}
    </Bar>
  );
}

// ── the one tree-view header (T4) ──────────────────────────────────────────
// Collapses the old ActiveCard / ConversationHeader / SessionDetail headers
// into ONE: state · host · branch · short id, plus merge/end for a live session.

function TreeViewHeader({
  session,
  live,
  onMerge,
  onEnd,
  busy,
}: {
  session: ZuzuuSessionEntry;
  live: boolean;
  onMerge?: () => void;
  onEnd?: () => void;
  busy: boolean;
}) {
  const meta = sessionStateMeta(session.state);
  const branch = session.git?.branch ?? null;
  return (
    <Bar border="b" surface="surface" className="!gap-2 !px-3 !py-1.5">
      <StatusPill tone={pillTone(meta.tone)}>{meta.label}</StatusPill>
      <span className="wc-sans min-w-0 truncate text-ui font-medium text-foreground">
        {agentTabTitle(session.host) || session.host || "session"}
      </span>
      {branch && (
        <span className="wc-mono inline-flex shrink-0 items-center gap-1 text-meta text-muted-foreground" title={`Session branch ${branch}`}>
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 5.5v5M5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 6c0 3-3 3-6 4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {branch}
        </span>
      )}
      <span className="wc-mono ml-auto shrink-0 text-meta text-muted-foreground">{shortSessionId(session.id)}</span>
      {live && onMerge && (
        <button
          onClick={onMerge}
          disabled={busy}
          className="wc-sans shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-meta text-muted-foreground transition-colors hover:bg-[var(--accent)] hover:text-foreground disabled:opacity-50"
          title="Squash this session's checkpoints to main"
        >
          Merge to main
        </button>
      )}
      {live && onEnd && (
        <button
          onClick={onEnd}
          disabled={busy}
          className="wc-sans shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-meta text-muted-foreground transition-colors hover:bg-[var(--accent)] hover:text-foreground disabled:opacity-50"
          title="End the session and close its terminal"
        >
          End
        </button>
      )}
    </Bar>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export function SessionPane() {
  const { tabs, loaded: sessionsLoaded, close } = useSessions();
  const zuzuuHealth = useZuzuuHealthQuery();
  const zuzuuHome = zuzuuHealth.data?.home === true;
  const sessionGit = useSessionGitQuery(zuzuuHome);

  const composerRef = useRef<HTMLDivElement>(null);
  const focusComposer = () => composerRef.current?.focus();

  // the captured-session list (T3 picker source) — shared cache + cadence.
  const sessionsQ = useQuery({
    queryKey: ["zuzuu", "sessions"],
    queryFn: zuzuuApi.sessions,
    refetchInterval: 6000,
  });
  const allSessions = sessionsQ.data?.sessions ?? [];
  const rows = pickerRows(allSessions, tabs);

  // which session the center VIEWS (explicit pick wins; else most-relevant row)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const viewed = resolveViewed(rows, selectedId);

  // per-viewed-session work tab: tree (default) | terminal (live only)
  const [workTab, setWorkTab] = useState<Record<string, WorkTab>>({});
  const tabOf = (id: string): WorkTab => workTab[id] ?? "tree";
  const setTabOf = (id: string, t: WorkTab) => setWorkTab((m) => ({ ...m, [id]: t }));

  // the live PTY tab for the viewed session (drives the Terminal tab); resolved
  // via the U4 ptyId join key.
  const viewedPtyTab = viewed?.live && viewed.session.ptyId
    ? tabs.find((t) => t.id === viewed.session.ptyId)
    : undefined;

  // recovery banner (leftover session branch) — shown once, inline, dismissable.
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const bootUnknown = zuzuuHealth.isPending || (zuzuuHome && sessionGit.isPending);
  const card = !bootUnknown ? centerCard(0, sessionGit.data) : { kind: "none" as const };
  const showRecovery = card.kind === "recovery" && !recoveryDismissed;

  // onboarding owns the empty pane until a zuzuu home exists
  const showSetup =
    sessionsLoaded && !bootUnknown && allSessions.length === 0 && zuzuuHealth.data?.home === false;

  // lifecycle actions for a LIVE viewed session
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const endViewed = async () => {
    if (!viewedPtyTab) return;
    setBusy(true);
    try {
      await close(viewedPtyTab.id);
    } finally {
      setBusy(false);
    }
  };
  const mergeViewed = () => {
    setBusy(true);
    void mergeSessionWithFallback()
      .catch((err: unknown) => window.alert(describeZuzuuError(err)))
      .finally(() => {
        setBusy(false);
        refreshSessionGit(queryClient);
      });
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* one inline recovery banner — NOT a modal, NOT a duplicate band */}
      {showRecovery && card.kind === "recovery" && (
        <RecoveryBanner
          branch={card.branch}
          checkpoints={card.checkpoints}
          onDismiss={() => setRecoveryDismissed(true)}
        />
      )}

      {/* the slim session picker (T3) — the one switcher */}
      <SessionPicker rows={rows} viewedId={viewed?.session.id ?? null} onSelect={setSelectedId} />

      {/* the viewed session: tree | terminal. Every LIVE PTY tab keeps an
          always-mounted TermView (visibility toggle) so the PTY survives both
          session switches AND tree↔terminal switches — the hot path is untouched. */}
      <div className="relative min-h-0 flex-1">
        {viewed && (
          <ViewedSession
            key={viewed.session.id}
            row={viewed}
            ptyTab={viewedPtyTab}
            workTab={tabOf(viewed.session.id)}
            onSetWorkTab={(t) => setTabOf(viewed.session.id, t)}
            onFocusComposer={focusComposer}
            onCloseTab={() => viewedPtyTab && void close(viewedPtyTab.id)}
            onEnd={() => void endViewed()}
            onMerge={mergeViewed}
            busy={busy}
          />
        )}

        {/* the calm resting state — nothing captured yet, no setup pending */}
        {allSessions.length === 0 && !showSetup && !showRecovery && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="select-none text-2xl text-muted-foreground">❯_</span>
          </div>
        )}

        {/* setup onboarding (no zuzuu home yet) keeps its centered placement */}
        {showSetup && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/90 p-6">
            <SetupZuzuuCard zuzuuBin={zuzuuHealth.data?.zuzuuBin ?? false} />
          </div>
        )}

        {/* keep EVERY live PTY's TermView mounted, even when not the viewed
            session, so its WebSocket / flow-control never tears down. Only the
            viewed-and-terminal one is visible; the rest are hidden. */}
        {tabs
          .filter((t) => t.id !== viewedPtyTab?.id)
          .map((t) => (
            <div key={t.id} className="absolute inset-0" style={{ visibility: "hidden" }} aria-hidden>
              <TermView
                sessionId={t.id}
                active={false}
                sessionType={t.type}
                host={t.host}
                onStartNew={focusComposer}
                onCloseTab={() => void close(t.id)}
              />
            </div>
          ))}
      </div>

      {/* the composer — the one way to start a session */}
      {zuzuuHome && <SessionComposer ref={composerRef} />}
    </div>
  );
}

/**
 * The viewed session's body: the one tree-view header + tree | terminal tabs.
 * A LIVE session gets a Terminal tab (its always-mounted TermView is the live
 * surface) and merge/end actions; a PAST session renders only the static tree.
 */
function ViewedSession({
  row,
  ptyTab,
  workTab,
  onSetWorkTab,
  onFocusComposer,
  onCloseTab,
  onEnd,
  onMerge,
  busy,
}: {
  row: PickerRow;
  ptyTab: ReturnType<typeof useSessions.getState>["tabs"][number] | undefined;
  workTab: WorkTab;
  onSetWorkTab: (t: WorkTab) => void;
  onFocusComposer: () => void;
  onCloseTab: () => void;
  onEnd: () => void;
  onMerge: () => void;
  busy: boolean;
}) {
  const session = row.session;
  const live = row.live;
  // a past session has no terminal tab → always the tree
  const view: WorkTab = live ? workTab : "tree";

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col">
      <TreeViewHeader
        session={session}
        live={live}
        onMerge={live ? onMerge : undefined}
        onEnd={live ? onEnd : undefined}
        busy={busy}
      />
      {live && (
        <Bar border="b" surface="app" className="!px-0">
          <TabBar>
            <Tab active={view === "tree"} onClick={() => onSetWorkTab("tree")}>
              Tree
            </Tab>
            <Tab
              active={view === "terminal"}
              onClick={() => onSetWorkTab("terminal")}
              leading={<StatusDot tone={ptyTab?.alive ? "ok" : "idle"} />}
            >
              Terminal
            </Tab>
          </TabBar>
        </Bar>
      )}
      <div className="relative min-h-0 flex-1">
        {/* the tree (default surface for both live + past) */}
        <div className="absolute inset-0" style={{ visibility: view === "tree" ? "visible" : "hidden" }}>
          <SessionTree
            sessionId={session.id}
            alive={live}
            enabled
            onOpenTerminal={live ? () => onSetWorkTab("terminal") : undefined}
          />
        </div>
        {/* the live terminal — the SAME TermView, always mounted (visibility
            toggle, never unmounted) so the PTY / WebSocket / flow-control are
            untouched. Only present for a live session with a workbench PTY. */}
        {live && ptyTab && (
          <div className="absolute inset-0" style={{ visibility: view === "terminal" ? "visible" : "hidden" }}>
            <TermView
              sessionId={ptyTab.id}
              active={view === "terminal"}
              sessionType={ptyTab.type}
              host={ptyTab.host}
              onStartNew={onFocusComposer}
              onCloseTab={onCloseTab}
            />
          </div>
        )}
      </div>
    </div>
  );
}

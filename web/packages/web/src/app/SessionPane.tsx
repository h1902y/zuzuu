// The center session pane. Each session is rendered as a CONVERSATION first:
// a calm transcript of one-line receipts (the default tab) with the live
// xterm terminal demoted to a sibling "Terminal" tab in the same work pane.
// Also: the agent-session tab strip, the load-time center cards (recovery /
// setup) and the bottom session composer ("Start a session with…").
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessions, type SessionTab } from "../state/sessions";
import { TermView } from "../term/TermView";
import { Bar, Tab, TabBar, IconButton, StatusDot, StatusPill, Spinner, confirm } from "../components/ui";
import { RecoveryCard, SetupZuzuuCard, SessionTranscript } from "../components/SessionCards";
import { SessionComposer } from "../components/SessionComposer";
import { centerCard, traceSessionForTab } from "../lib/session-cards";
import { sessionStateMeta, shortSessionId } from "../panel/sections";
import { mergeSessionWithFallback, refreshSessionGit } from "../lib/session-git-actions";
import { describeZuzuuError, zuzuuApi } from "../lib/zuzuu-api";
import { agentTabTitle } from "../modules/host-launch";
import { useSessionGitQuery, useZuzuuHealthQuery } from "./queries";

/** Which sub-surface of a session's work pane is showing. */
type WorkTab = "conversation" | "terminal";

function pillTone(tone: string): "ok" | "warn" | "bad" | "neutral" {
  if (tone === "ok") return "ok";
  if (tone === "warn") return "warn";
  if (tone === "danger") return "bad";
  return "neutral";
}

/**
 * The unified session-state header (U5). When the conversation in front of you
 * IS the workbench's active trace session (resolved by the U4 ptyId join key),
 * this folds what the old straddling ActiveCard band showed — state · host ·
 * branch · short id — into the conversation itself, plus the session lifecycle
 * actions (merge to main / end). There is no longer a separate persistent band
 * for the open session; this single header is the one session-state surface.
 *
 * `tab` is the live PTY tab; `session` is its joined trace record (null when no
 * record joins — pre-U4 sessions — in which case we render nothing, leaving the
 * tab strip + work-tabs as the only chrome, which still reads honestly).
 */
function ConversationHeader({ tab }: { tab: SessionTab }) {
  const sessionsQ = useQuery({
    queryKey: ["zuzuu", "sessions"],
    queryFn: zuzuuApi.sessions,
    refetchInterval: 6000,
  });
  const session = traceSessionForTab(sessionsQ.data?.sessions ?? [], tab.id);
  const queryClient = useQueryClient();
  const close = useSessions((s) => s.close);
  const [busy, setBusy] = useState(false);

  // No joined trace record (pre-U4 / not yet recorded) — no folded state to
  // show. The tab strip + Conversation/Terminal tabs remain the chrome.
  if (!session) return null;

  const meta = sessionStateMeta(session.state);
  const branch = session.git?.branch ?? null;

  const merge = () => {
    setBusy(true);
    void mergeSessionWithFallback()
      .catch((err: unknown) => window.alert(describeZuzuuError(err)))
      .finally(() => {
        setBusy(false);
        refreshSessionGit(queryClient);
      });
  };

  const end = async () => {
    const ok = await confirm({
      title: "End this session",
      message: branch
        ? `End the session and close its terminal? Checkpoints stay on ${branch} until you merge.`
        : "End the session and close its terminal?",
      okLabel: "End session",
    });
    if (!ok) return;
    await close(tab.id);
  };

  return (
    <Bar border="b" surface="surface" className="!gap-2 !px-3 !py-1.5">
      <StatusPill tone={pillTone(meta.tone)}>{meta.label}</StatusPill>
      <span className="wc-sans min-w-0 truncate text-ui font-medium text-foreground">
        {agentTabTitle(session.host)}
      </span>
      {branch && (
        <span className="wc-mono inline-flex shrink-0 items-center gap-1 text-meta text-muted-foreground" title={`Session branch ${branch}`}>
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 5.5v5M5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 6c0 3-3 3-6 4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {branch}
        </span>
      )}
      <span className="wc-mono ml-auto shrink-0 text-meta text-muted-foreground">{shortSessionId(session.id)}</span>
      {busy && <Spinner />}
      <button
        onClick={merge}
        disabled={busy}
        className="wc-sans shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-meta text-muted-foreground transition-colors hover:bg-[var(--accent)] hover:text-foreground disabled:opacity-50"
        title="Squash this session's checkpoints to main"
      >
        Merge to main
      </button>
      <button
        onClick={() => void end()}
        disabled={busy}
        className="wc-sans shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-meta text-muted-foreground transition-colors hover:bg-[var(--accent)] hover:text-foreground disabled:opacity-50"
        title="End the session and close its terminal"
      >
        End
      </button>
    </Bar>
  );
}

export function SessionPane() {
  const { tabs, activeId, loaded: sessionsLoaded, close, setActive } = useSessions();
  const zuzuuHealth = useZuzuuHealthQuery();
  const zuzuuHome = zuzuuHealth.data?.home === true;
  // session-git status for the recovery card (shares the footer indicator's cache)
  const sessionGit = useSessionGitQuery(zuzuuHome);
  const composerRef = useRef<HTMLDivElement>(null);
  const focusComposer = () => composerRef.current?.focus();

  // per-session work-pane tab — conversation is the hero default; the terminal
  // is on-demand. Tracked per id so switching sessions keeps each one's view.
  const [workTab, setWorkTab] = useState<Record<string, WorkTab>>({});
  const tabOf = (id: string): WorkTab => workTab[id] ?? "conversation";
  const setTabOf = (id: string, t: WorkTab) => setWorkTab((m) => ({ ...m, [id]: t }));

  // hold the boot-time card until health + session-git have answered once, so
  // a leftover branch renders recovery directly instead of flashing the rest state
  const bootUnknown =
    tabs.length === 0 && (zuzuuHealth.isPending || (zuzuuHome && sessionGit.isPending));
  const card =
    sessionsLoaded && !bootUnknown ? centerCard(tabs.length, sessionGit.data) : { kind: "none" as const };
  // onboarding owns the empty pane until a zuzuu home exists
  const showSetup =
    sessionsLoaded && !bootUnknown && tabs.length === 0 && zuzuuHealth.data?.home === false;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <Bar border="b" surface="surface" className="!gap-0 overflow-x-auto !px-0">
        <TabBar>
          {tabs.map((tab) => {
            // agent tabs carry the host's display name; shells keep the live title
            const label = tab.type === "agent" ? agentTabTitle(tab.host) : tab.title;
            return (
              <Tab
                key={tab.id}
                active={tab.id === activeId}
                onClick={() => setActive(tab.id)}
                onClose={() => void close(tab.id)}
                title={tab.cwdLive ? `${label} · ${tab.cwdLive.cwd}` : label}
                leading={<StatusDot tone={tab.alive ? "ok" : "idle"} />}
              >
                {label}
              </Tab>
            );
          })}
        </TabBar>
        <IconButton
          title="New agent session — pick a host below"
          iconPath="M8 3v10M3 8h10"
          className="mx-1"
          onClick={focusComposer}
        />
      </Bar>
      {/* the work pane — one per session, all kept mounted so the terminals
          (and their PTYs) survive session switches and work-tab switches */}
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const view = tabOf(tab.id);
          return (
            <div
              key={tab.id}
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{ visibility: active ? "visible" : "hidden" }}
            >
              {/* the one session-state surface: state · host · branch · merge/end,
                  folded in from the old straddling ActiveCard band (U5) */}
              <ConversationHeader tab={tab} />
              {/* work-pane sub-tabs: Conversation (the hero) | Terminal (raw) */}
              <Bar border="b" surface="app" className="!px-0">
                <TabBar>
                  <Tab
                    active={view === "conversation"}
                    onClick={() => setTabOf(tab.id, "conversation")}
                  >
                    Conversation
                  </Tab>
                  <Tab
                    active={view === "terminal"}
                    onClick={() => setTabOf(tab.id, "terminal")}
                    leading={<StatusDot tone={tab.alive ? "ok" : "idle"} />}
                  >
                    Terminal
                  </Tab>
                </TabBar>
              </Bar>
              <div className="relative min-h-0 flex-1">
                {/* Conversation — the receipts transcript (default surface) */}
                <div
                  className="absolute inset-0"
                  style={{ visibility: view === "conversation" ? "visible" : "hidden" }}
                >
                  <SessionTranscript sessionId={tab.id} alive={tab.alive} />
                </div>
                {/* Terminal — the SAME TermView, only relocated into this tab
                    panel. Kept always-mounted (visibility toggle, never
                    unmounted) so the PTY / WebSocket / flow-control are
                    untouched. */}
                <div
                  className="absolute inset-0"
                  style={{ visibility: active && view === "terminal" ? "visible" : "hidden" }}
                >
                  <TermView
                    sessionId={tab.id}
                    active={active && view === "terminal"}
                    sessionType={tab.type}
                    host={tab.host}
                    onStartNew={focusComposer}
                    onCloseTab={() => void close(tab.id)}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {/* the calm resting state — nothing but the mark above the composer */}
        {tabs.length === 0 && card.kind === "none" && !showSetup && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="select-none text-2xl text-muted-foreground">❯_</span>
          </div>
        )}
        {/* load-time center cards: recovery (leftover session branch) and
            setup (no zuzuu home yet) keep their center placement */}
        {(card.kind === "recovery" || showSetup) && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/90 p-6">
            {card.kind === "recovery" ? (
              <RecoveryCard branch={card.branch} checkpoints={card.checkpoints} />
            ) : (
              <SetupZuzuuCard zuzuuBin={zuzuuHealth.data?.zuzuuBin ?? false} />
            )}
          </div>
        )}
      </div>
      {/* the composer — the one way to start a session (hosts only) */}
      {zuzuuHome && <SessionComposer ref={composerRef} />}
    </div>
  );
}

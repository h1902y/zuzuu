// The center session pane: agent-session tabs, the always-mounted terminals,
// and the session-surface center cards (start / setup / recovery).
import { useState } from "react";
import { useSessions } from "../state/sessions";
import { TermView } from "../term/TermView";
import { Bar, Tab, TabBar, IconButton, StatusDot } from "../components/ui";
import { StartSessionCard, RecoveryCard, SetupZuzuuCard } from "../components/SessionCards";
import { centerCard } from "../lib/session-cards";
import { agentTabTitle, hostSpawnSpec } from "../faculties/host-launch";
import { startAgentSession } from "../lib/agent-launch";
import { useSessionGitQuery, useZuzuuHealthQuery } from "./queries";

export function SessionPane() {
  const { tabs, activeId, loaded: sessionsLoaded, close, setActive } = useSessions();
  const zuzuuHealth = useZuzuuHealthQuery();
  const zuzuuHome = zuzuuHealth.data?.home === true;
  // session-git status for the recovery card (shares the footer indicator's cache)
  const sessionGit = useSessionGitQuery(zuzuuHome);

  // startOverlay = the user asked for an agent session while sessions exist
  // (+ button / end-card CTA); with zero sessions the start card is the default.
  const [startOverlay, setStartOverlay] = useState(false);
  // hold the boot-time card until health + session-git have answered once, so
  // a leftover branch renders recovery directly instead of flashing the start card
  const recoveryUnknown =
    tabs.length === 0 && !startOverlay && (zuzuuHealth.isPending || (zuzuuHome && sessionGit.isPending));
  const card =
    sessionsLoaded && !recoveryUnknown
      ? centerCard(tabs.length, startOverlay, sessionGit.data)
      : { kind: "none" as const };
  const startHost = (rowCommand: string) => {
    setStartOverlay(false);
    const spec = hostSpawnSpec(rowCommand);
    // single-active-agent rule lives in startAgentSession: while one is
    // alive, picking a host focuses it instead of spawning a second one
    if (spec) void startAgentSession(spec).catch((err: Error) => window.alert(err.message));
  };

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
          title="New agent session"
          iconPath="M8 3v10M3 8h10"
          className="mx-1"
          onClick={() => setStartOverlay(true)}
        />
      </Bar>
      {/* terminals — all kept mounted so sessions survive tab switches */}
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{ visibility: tab.id === activeId ? "visible" : "hidden" }}
          >
            <TermView
              sessionId={tab.id}
              active={tab.id === activeId}
              sessionType={tab.type}
              host={tab.host}
              onStartNew={() => setStartOverlay(true)}
              onCloseTab={() => void close(tab.id)}
            />
          </div>
        ))}
        {/* session-surface cards: start (default with zero sessions, or
            requested via +) and recovery (leftover session branch on load) */}
        {card.kind !== "none" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-app/90 p-6">
            {card.kind === "recovery" ? (
              <RecoveryCard branch={card.branch} checkpoints={card.checkpoints} />
            ) : zuzuuHealth.data?.home === false ? (
              // onboarding takes the start card's slot until a home exists
              <SetupZuzuuCard
                zuzuuBin={zuzuuHealth.data.zuzuuBin}
                {...(tabs.length > 0 ? { onDismiss: () => setStartOverlay(false) } : {})}
              />
            ) : (
              <StartSessionCard
                onHost={startHost}
                {...(tabs.length > 0 ? { onDismiss: () => setStartOverlay(false) } : {})}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

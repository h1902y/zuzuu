// The status bar, calm (app-shell brief): a connection StatusDot · the
// session-git indicator · the agent progression pill · a quiet ⌘K hint. The
// workspace/recents switcher moved entirely into the sidebar's single
// workspace dropdown (one directory control), so the footer is status-only.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { useConnection } from "../state/connection";
import { Bar, Kbd, StatusDot } from "../components/ui";
import { SessionIndicator } from "../components/SessionIndicator";
import { Settings } from "../components/Settings";
import { zuzuuApi } from "../lib/zuzuu-api";
import { pendingTotal } from "../panel/sections";

/** Ambient "Your agent" progression pill — calm, always-on evidence of growth.
 *  Only renders when there is a zuzuu home; metrics appear only when present. */
function AgentProgressionPill({ zuzuuHome }: { zuzuuHome: boolean }) {
  const status = useQuery({
    queryKey: ["zuzuu", "status"],
    queryFn: zuzuuApi.status,
    refetchInterval: 8000,
    enabled: zuzuuHome,
  });
  const overview = useQuery({
    queryKey: ["zuzuu", "overview"],
    queryFn: zuzuuApi.overview,
    refetchInterval: 8000,
    enabled: zuzuuHome,
  });

  if (!zuzuuHome) return null;

  // whole-brain checkpoint count — a checkpoint IS the composed whole-agent
  // generation, so "Gen N" honestly reflects the minted checkpoint number.
  const checkpoints = status.data?.checkpoints ?? null;
  // total knowledge items (first approximation of "facts")
  const knowledgeEntry = overview.data?.modules.find((m) => m.id === "knowledge");
  const totalFacts = knowledgeEntry?.counts.items ?? null;
  // total pending proposals across all modules
  const totalPending = overview.data?.modules ? pendingTotal(overview.data.modules) : null;

  // nothing loaded yet → don't render a skeleton
  if (checkpoints === null && totalFacts === null && totalPending === null) return null;

  const hasPending = (totalPending ?? 0) > 0;

  const parts: string[] = [];
  // Only present "vN" when there is at least one whole-brain snapshot —
  // never imply a version from module counts.
  if (checkpoints !== null && checkpoints > 0) parts.push(`v${checkpoints}`);
  if (totalFacts !== null) parts.push(`${totalFacts} fact${totalFacts !== 1 ? "s" : ""}`);

  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-meta text-muted-foreground"
      style={{ background: "color-mix(in oklab, var(--color-ink-600) 8%, transparent)" }}
      title="Your agent's current state — snapshots saved, facts known, proposals awaiting review"
    >
      <span className="wc-sans text-muted-foreground">Your agent:</span>
      {parts.length > 0 && (
        <span className="wc-sans text-muted-foreground">{parts.join(" · ")}</span>
      )}
      {hasPending && (
        <>
          <span aria-hidden className="text-muted-foreground">·</span>
          <span
            className="wc-sans font-medium tabular-nums"
            style={{ color: "color-mix(in oklab, var(--color-warn) 82%, white)" }}
          >
            {totalPending} pending
          </span>
        </>
      )}
    </span>
  );
}

export function Footer({
  zuzuuHome,
  onOpenPalette,
}: {
  zuzuuHome: boolean;
  onOpenPalette: () => void;
}) {
  const conn = useConnection();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const connTone = conn.state === "connected" ? "ok" : conn.state === "reconnecting" ? "warn" : "bad";
  const connLabel =
    conn.state === "connected" ? "Connected" : conn.state === "reconnecting" ? "Reconnecting…" : "Disconnected";

  return (
    <>
    <Bar border="t" surface="surface" className="relative !gap-2.5 text-meta text-muted-foreground">
      {/* calm connection status */}
      <span className="flex shrink-0 items-center gap-1.5" title={`daemon ${conn.state}`}>
        <StatusDot tone={connTone} pulse={conn.state === "reconnecting"} />
        <span className="wc-sans text-muted-foreground">{connLabel}</span>
      </span>

      <span aria-hidden className="text-muted-foreground">·</span>

      {/* session-git indicator (restyled context-only; its own quiet popover) */}
      <SessionIndicator enabled={zuzuuHome} />

      {/* ambient agent progression pill — calm always-on evidence of growth */}
      <AgentProgressionPill zuzuuHome={zuzuuHome} />

      <button
        onClick={onOpenPalette}
        className="wc-sans ml-auto flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-muted-foreground transition-colors hover:text-foreground"
        title="Command palette"
      >
        <span>Commands</span>
        <Kbd>⌘K</Kbd>
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-[var(--accent)] hover:text-foreground"
        title="Settings"
        aria-label="Open settings"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>
    </Bar>

    <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

// The status bar, calm (app-shell brief): a connection StatusDot · the
// workspace name (still the recents switcher) · the session-git indicator ·
// a quiet ⌘K hint. The dense mono ❯_ mark, the live-stats tooltip and the
// help menu were retired here — review lives in the panel's "Needs you"
// section, help in the palette.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnection } from "../state/connection";
import { Bar, Kbd, StatusDot, cx } from "../components/ui";
import { SessionIndicator } from "../components/SessionIndicator";
import { capRecents, tilde } from "../onboarding/vault-picker-logic";
import { useWorkspaceConfigQuery, useWorkspaceQuery } from "./queries";
import { switchVault } from "./vault";

export function Footer({
  zuzuuHome,
  onOpenPalette,
  onOpenVaultPicker,
}: {
  zuzuuHome: boolean;
  onOpenPalette: () => void;
  onOpenVaultPicker: () => void;
}) {
  const queryClient = useQueryClient();
  const conn = useConnection();
  const workspace = useWorkspaceQuery();
  const wsConfig = useWorkspaceConfigQuery();

  const [vaultMenuOpen, setVaultMenuOpen] = useState(false);
  const vaultRecents = capRecents(wsConfig.data?.recent ?? [], workspace.data?.root, 5);

  const pickVault = (path: string) => {
    setVaultMenuOpen(false);
    void switchVault(queryClient, path);
  };

  const connTone = conn.state === "connected" ? "ok" : conn.state === "reconnecting" ? "warn" : "bad";
  const connLabel =
    conn.state === "connected" ? "Connected" : conn.state === "reconnecting" ? "Reconnecting…" : "Disconnected";

  return (
    <Bar border="t" surface="surface" className="relative !gap-2.5 text-meta text-ink-500">
      {/* calm connection status */}
      <span className="flex shrink-0 items-center gap-1.5" title={`daemon ${conn.state}`}>
        <StatusDot tone={connTone} pulse={conn.state === "reconnecting"} />
        <span className="wc-sans text-ink-400">{connLabel}</span>
      </span>

      <span aria-hidden className="text-ink-600">·</span>

      {/* workspace name → recents switcher (Browse stays; restyled calm) */}
      <div className="relative shrink-0">
        <button
          onClick={() => setVaultMenuOpen((v) => !v)}
          className="wc-sans flex max-w-72 items-center gap-1 truncate rounded-[var(--radius-sm)] px-1 text-ink-300 transition-colors hover:text-ink-100"
          title={workspace.data?.root}
        >
          <span className="truncate">{workspace.data?.name ?? "…"}</span>
          <svg viewBox="0 0 16 16" className={cx("h-2.5 w-2.5 shrink-0 transition-transform", vaultMenuOpen && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {vaultMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setVaultMenuOpen(false)} />
            <div
              style={{ boxShadow: "var(--shadow-menu)" }}
              className="absolute bottom-full left-0 z-50 mb-1 max-h-[60vh] w-64 overflow-y-auto rounded-[var(--radius-ui)] border border-border bg-elevated py-1"
            >
              <button
                onClick={() => {
                  setVaultMenuOpen(false);
                  onOpenVaultPicker();
                }}
                className="wc-sans flex w-full items-center px-3 py-1.5 text-left text-ui text-ink-100 transition-colors hover:bg-hover"
              >
                Browse… <span className="ml-auto text-ink-500">⌘⇧O</span>
              </button>
              {vaultRecents.length > 0 && (
                <div className="mt-1 border-t border-border pt-1">
                  <div className="wc-eyebrow px-3 py-0.5">Recent</div>
                  {vaultRecents.map((r) => (
                    <button
                      key={r}
                      onClick={() => pickVault(r)}
                      className="wc-sans block w-full truncate px-3 py-1.5 text-left text-ui text-ink-300 transition-colors hover:bg-hover hover:text-ink-100"
                      title={r}
                    >
                      {tilde(r)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* session-git indicator (restyled context-only; its own quiet popover) */}
      <SessionIndicator enabled={zuzuuHome} />

      <button
        onClick={onOpenPalette}
        className="wc-sans ml-auto flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-ink-400 transition-colors hover:text-ink-100"
        title="Command palette"
      >
        <span>Commands</span>
        <Kbd>⌘K</Kbd>
      </button>
    </Bar>
  );
}

// The status bar: zuzuu agent chip · the ❯_ connection mark · vault menu ·
// session-git indicator · ⌘K.
import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { zuzuuApi } from "../lib/zuzuu-api";
import { useConnection } from "../state/connection";
import { useSessions } from "../state/sessions";
import { useExplorer } from "../state/explorer";
import { Bar } from "../components/ui";
import { SessionIndicator } from "../components/SessionIndicator";
import { agentChipLabel } from "../faculties/agent-chip";
import { pendingReviewCount } from "../faculties/review-queue";
import { useReviewOpen } from "../state/review";
import { capRecents, menuSubdirs, parentDir, tilde } from "../onboarding/vault-picker-logic";
import {
  useFilesQuery, useWorkspaceConfigQuery, useWorkspaceQuery,
  useZuzuuStatusQuery,
} from "./queries";
import { switchVault } from "./vault";

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
const fmtMB = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

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
  const { tabs, activeId } = useSessions();
  const workspace = useWorkspaceQuery();
  const wsConfig = useWorkspaceConfigQuery();
  const files = useFilesQuery();
  const closeSearch = useExplorer((s) => s.closeSearch);
  const revealPath = useExplorer((s) => s.revealPath);

  const zuzuuStatus = useZuzuuStatusQuery(zuzuuHome);
  const zuzuuEval = useQuery({ queryKey: ["zuzuu", "eval"], queryFn: zuzuuApi.evalRanked, refetchInterval: 8000, enabled: zuzuuHome });
  const zuzuuActions = useQuery({ queryKey: ["zuzuu", "faculty", "actions"], queryFn: () => zuzuuApi.faculty("actions"), refetchInterval: 8000, enabled: zuzuuHome });
  const openReview = useReviewOpen((s) => s.setOpen);
  const reviewCount = pendingReviewCount(zuzuuEval.data?.ranked ?? [], zuzuuActions.data?.proposals ?? []);

  const [vaultMenuOpen, setVaultMenuOpen] = useState(false);
  // status-bar vault menu: one-click parent + subdirectory switching. The
  // root listing shares FileTree's ["dir",""] cache, so it's usually instant.
  const rootList = useQuery({
    queryKey: ["dir", ""],
    queryFn: () => api.listDir(""),
    enabled: vaultMenuOpen,
    placeholderData: keepPreviousData,
  });
  const vaultRoot = workspace.data?.root;
  const vaultParent = vaultRoot ? parentDir(vaultRoot) : null;
  const vaultSubdirs = menuSubdirs(rootList.data?.entries ?? [], 8);
  const vaultRecents = capRecents(wsConfig.data?.recent ?? [], vaultRoot, 5);

  const pickVault = (path: string) => {
    setVaultMenuOpen(false);
    void switchVault(queryClient, path);
  };

  // the active session's live cwd — folded into the vault menu button
  const activeTab = tabs.find((t) => t.id === activeId);
  const cwdLive = activeTab?.cwdLive ?? null;

  return (
    <Bar border="t" surface="surface" className="relative !gap-2.5 text-meta text-ink-500">
      {/* zuzuu agent chip — active generation · pending review; opens the ceremony */}
      {zuzuuHome && (
        <button
          onClick={() => openReview(true)}
          className="shrink-0 hover:text-accent"
          title="zuzuu — open review"
        >
          {agentChipLabel(zuzuuStatus.data?.activeGeneration, reviewCount)}
        </button>
      )}
      {/* the ❯_ mark carries connection health: calm when connected (live
          stats on hover), warn/red + pulse only while reconnecting/down */}
      <span
        className={`shrink-0 ${
          conn.state === "connected"
            ? "text-accent-dim"
            : conn.state === "reconnecting"
              ? "animate-pulse text-warn"
              : "text-danger"
        }`}
        title={[
          `daemon ${conn.state}`,
          files.data ? `${files.data.files.length}${files.data.truncated ? "+" : ""} files` : null,
          `${tabs.filter((t) => t.alive).length} session(s)`,
          conn.uptimeMs !== null ? `up ${fmtUptime(conn.uptimeMs)}` : null,
          conn.rss !== null ? fmtMB(conn.rss) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        ❯_
      </span>

      {/* vault name (· session cwd when it differs from the root) → vault menu */}
      <div className="relative shrink-0">
        <button
          onClick={() => setVaultMenuOpen((v) => !v)}
          className="max-w-72 truncate rounded px-1 text-ink-300 hover:text-accent"
          title={cwdLive ? `${workspace.data?.root} · cwd ${cwdLive.cwd || "."}` : workspace.data?.root}
        >
          {workspace.data?.name ?? "…"}
          {cwdLive?.cwd && !cwdLive.outside && <span className="text-ink-500"> · {cwdLive.cwd}</span>}
          {cwdLive?.outside && <span className="text-warn"> · {cwdLive.cwd} (outside)</span>}
          {" "}▾
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
                className="block w-full px-3 py-1.5 text-left text-ui text-ink-100 hover:bg-hover"
              >
                Browse… <span className="text-ink-500">⌘⇧O</span>
              </button>
              {cwdLive?.cwd && !cwdLive.outside && (
                <button
                  onClick={() => {
                    setVaultMenuOpen(false);
                    closeSearch(); // make sure the tree is showing
                    revealPath(cwdLive.cwd);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-ui text-ink-100 hover:bg-hover"
                >
                  Reveal cwd in tree
                </button>
              )}
              {vaultParent && (
                <button
                  onClick={() => pickVault(vaultParent)}
                  className="block w-full truncate px-3 py-1 text-left text-ui text-ink-300 hover:bg-hover hover:text-ink-100"
                  title={`Switch vault to ${vaultParent}`}
                >
                  ↑ {tilde(vaultParent)}
                </button>
              )}
              {vaultSubdirs.length > 0 && vaultRoot && (
                <div className="mt-1 border-t border-border pt-1">
                  <div className="px-3 py-0.5 text-meta uppercase tracking-wider text-ink-500">Subfolders</div>
                  {vaultSubdirs.map((name) => (
                    <button
                      key={name}
                      onClick={() => pickVault(`${vaultRoot}/${name}`)}
                      className="block w-full truncate px-3 py-1 text-left text-ui text-ink-300 hover:bg-hover hover:text-ink-100"
                      title={`Switch vault to ${vaultRoot}/${name}`}
                    >
                      {name}/
                    </button>
                  ))}
                </div>
              )}
              {vaultRecents.length > 0 && (
                <div className="mt-1 border-t border-border pt-1">
                  <div className="px-3 py-0.5 text-meta uppercase tracking-wider text-ink-500">Recent</div>
                  {vaultRecents.map((r) => (
                    <button
                      key={r}
                      onClick={() => pickVault(r)}
                      className="block w-full truncate px-3 py-1 text-left text-ui text-ink-300 hover:bg-hover hover:text-ink-100"
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

      {/* session-git indicator (the old git-branch item's slot) */}
      <SessionIndicator enabled={zuzuuHome} />

      <button
        onClick={onOpenPalette}
        className="ml-auto shrink-0 rounded-[var(--radius-sm)] px-1.5 text-ink-500 hover:text-accent"
        title="Command palette"
      >
        ⌘K
      </button>
    </Bar>
  );
}

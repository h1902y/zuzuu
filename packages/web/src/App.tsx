import { useEffect, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./lib/api";
import { fsEvents } from "./lib/fs-events";
import { applyWorkflow, type Workflow } from "@webcode/protocol";
import { useSessions } from "./state/sessions";
import { useExplorer } from "./state/explorer";
import { FileTree } from "./explorer/FileTree";
import { SearchPanel } from "./explorer/SearchPanel";
import { GitPanel } from "./explorer/GitPanel";
import { TermView } from "./term/TermView";
import { EditorPane } from "./editor/EditorPane";
import { useEditor } from "./state/editor";
import { CommandPalette } from "./palette/CommandPalette";
import { WorkflowSaveModal, WorkflowRunModal } from "./workflows/WorkflowModals";
import { termRegistry } from "./term/registry";
import { useConnection } from "./state/connection";
import { DisconnectedBanner } from "./DisconnectedBanner";
import { WelcomeOverlay } from "./onboarding/WelcomeOverlay";
import { VaultPicker } from "./onboarding/VaultPicker";

const parentOf = (path: string) => path.split("/").slice(0, -1).join("/");

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
const fmtMB = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

export default function App() {
  const queryClient = useQueryClient();
  const { tabs, activeId, init, create, close, setActive } = useSessions();
  const [initError, setInitError] = useState<string | null>(null);

  const workspace = useQuery({ queryKey: ["workspace"], queryFn: api.workspace });
  const conn = useConnection();
  const wsConfig = useQuery({ queryKey: ["workspace", "config"], queryFn: api.workspaceConfig });
  const gitStatus = useQuery({ queryKey: ["git", "status"], queryFn: api.gitStatus, refetchInterval: 4000 });
  const files = useQuery({ queryKey: ["files"], queryFn: api.listFiles, staleTime: 30_000 });
  const [vaultPickerOpen, setVaultPickerOpen] = useState(false);
  const [vaultMenuOpen, setVaultMenuOpen] = useState(false);

  useEffect(() => {
    init().catch((err: Error) => setInitError(err.message));
  }, [init]);

  useEffect(() => {
    if (!workspace.data) return;
    fsEvents.start((path) => {
      void queryClient.invalidateQueries({ queryKey: ["dir", path] });
      void queryClient.invalidateQueries({ queryKey: ["git", "status"] });
      // refresh any open preview whose file lives in the changed directory
      void queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === "preview" &&
          typeof q.queryKey[1] === "string" &&
          parentOf(q.queryKey[1]) === path,
      });
    });
  }, [workspace.data, queryClient]);

  const hasEditor = useEditor((s) => s.openFiles.length > 0);
  const saveActive = useEditor((s) => s.saveActive);
  const sidebarMode = useExplorer((s) => s.sidebarMode);
  const setSidebarMode = useExplorer((s) => s.setSidebarMode);
  const revealPath = useExplorer((s) => s.revealPath);
  const activeTab = tabs.find((t) => t.id === activeId);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<"all" | "history">("all");
  const [runWorkflow, setRunWorkflow] = useState<Workflow | null>(null);

  // global shortcuts: ⌘K palette, ⌘R run-recent, ⌘S save active editor file
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteMode("all");
        setPaletteOpen((v) => !(v && paletteMode === "all"));
      } else if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        setPaletteMode("history");
        setPaletteOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveActive();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setVaultPickerOpen(true);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    const onOpenPicker = () => setVaultPickerOpen(true);
    const onSaveRec = () => void saveRecording();
    window.addEventListener("keydown", onKey);
    window.addEventListener("webcode:open-vault-picker", onOpenPicker);
    window.addEventListener("webcode:save-recording", onSaveRec);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("webcode:open-vault-picker", onOpenPicker);
      window.removeEventListener("webcode:save-recording", onSaveRec);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveActive, paletteMode]);

  // Switch the daemon's workspace, then reload into it (token cookie persists).
  const switchVault = async (path: string) => {
    setVaultMenuOpen(false);
    try {
      await api.switchWorkspace(path);
      window.location.reload();
    } catch (err) {
      window.alert(`Could not open vault: ${(err as Error).message}`);
    }
  };

  // A workflow with args opens the run modal; argless ones run immediately.
  const handleRunWorkflow = (wf: Workflow) => {
    const hasArgs = (wf.args?.length ?? 0) > 0 || /\{\{\s*\w+\s*\}\}/.test(wf.command);
    if (hasArgs) setRunWorkflow(wf);
    else termRegistry.get(activeId)?.sendInput(`\x15${applyWorkflow(wf.command, {})}\r`);
  };

  const saveRecording = async () => {
    // read the active session fresh — this is also invoked from a window event
    const s = useSessions.getState();
    const tab = s.tabs.find((t) => t.id === s.activeId);
    if (!tab) return;
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
    const path = window.prompt(
      "Save recording as (workspace-relative .cast):",
      `recordings/${tab.title}-${stamp}.cast`,
    );
    if (!path) return;
    try {
      const res = await api.saveRecording(tab.id, path);
      if (res.truncated) {
        window.alert("Saved — note: the oldest output was dropped (buffer cap reached).");
      }
    } catch (err) {
      window.alert(`Could not save recording: ${(err as Error).message}`);
    }
  };
  useEffect(() => {
    const name = workspace.data?.name ?? "webcode";
    document.title = activeTab ? `${activeTab.title} — ${name}` : name;
  }, [activeTab, workspace.data]);

  if (workspace.error || initError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-300">
        <div className="text-2xl text-accent">❯_</div>
        <div className="max-w-md text-center text-sm leading-relaxed">
          {(workspace.error as Error | null)?.message ?? initError}
        </div>
      </div>
    );
  }

  const dirtyCount = gitStatus.data?.entries.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <DisconnectedBanner state={conn.state} />
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize="22%" minSize="160px" maxSize="45%" className="bg-ink-900">
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 border-b border-ink-700">
              {(["files", "search", "git"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSidebarMode(mode)}
                  className={`flex-1 py-1 text-[11px] uppercase tracking-wider ${
                    sidebarMode === mode
                      ? "border-b border-accent text-ink-100"
                      : "text-ink-500 hover:text-ink-300"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {sidebarMode === "files" ? (
                <FileTree />
              ) : sidebarMode === "search" ? (
                <SearchPanel />
              ) : (
                <GitPanel />
              )}
            </div>
          </div>
        </Panel>
        <Separator className="w-px bg-ink-700 transition-colors hover:bg-accent-dim" />
        <Panel className="flex min-w-0 flex-col">
          {/* tab bar */}
          <div className="flex items-stretch gap-px overflow-x-auto border-b border-ink-700 bg-ink-900">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`group flex max-w-48 items-center gap-2 px-3 py-1.5 text-[12px] ${
                  tab.id === activeId
                    ? "bg-ink-950 text-ink-100"
                    : "bg-ink-900 text-ink-300 hover:bg-ink-850"
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tab.alive ? "bg-accent" : "bg-ink-500"}`} />
                <span className="truncate">{tab.title}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    void close(tab.id);
                  }}
                  className="rounded px-0.5 text-ink-500 opacity-0 hover:bg-ink-700 hover:text-ink-100 group-hover:opacity-100"
                >
                  ×
                </span>
              </button>
            ))}
            <button
              onClick={() => void create()}
              title="New terminal"
              className="px-3 text-ink-300 hover:bg-ink-850 hover:text-accent"
            >
              +
            </button>
          </div>
          {/* terminals — all kept mounted so sessions survive tab switches */}
          <div className="relative min-h-0 flex-1">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className="absolute inset-0"
                style={{ visibility: tab.id === activeId ? "visible" : "hidden" }}
              >
                <TermView sessionId={tab.id} active={tab.id === activeId} />
              </div>
            ))}
            {tabs.length === 0 && (
              <div className="flex h-full items-center justify-center text-[12px] text-ink-600">
                no terminal — press + above
              </div>
            )}
          </div>
        </Panel>
        {hasEditor && (
          <>
            <Separator className="w-px bg-ink-700 transition-colors hover:bg-accent-dim" />
            <Panel id="editor" defaultSize="42%" minSize="280px" className="min-w-0">
              <EditorPane />
            </Panel>
          </>
        )}
      </Group>
      {/* status bar */}
      <div className="relative flex items-center gap-2.5 border-t border-ink-700 bg-ink-900 px-3 py-1 text-[11px] text-ink-500">
        {/* connection health — hover reveals the live stats (files · sessions · uptime · mem) */}
        <span
          className="flex shrink-0 items-center gap-1.5"
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
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              conn.state === "connected"
                ? "bg-accent"
                : conn.state === "reconnecting"
                  ? "animate-pulse bg-yellow-500"
                  : "bg-danger"
            }`}
          />
          <span className="text-accent-dim">❯_</span>
        </span>

        {/* vault name → vault menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setVaultMenuOpen((v) => !v)}
            className="rounded px-1 text-ink-300 hover:text-accent"
            title={workspace.data?.root}
          >
            {workspace.data?.name ?? "…"} ▾
          </button>
          {vaultMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setVaultMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded border border-ink-700 bg-ink-850 py-1 shadow-xl">
                <button
                  onClick={() => {
                    setVaultMenuOpen(false);
                    setVaultPickerOpen(true);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-ink-100 hover:bg-ink-700"
                >
                  Switch vault… <span className="text-ink-500">⌘⇧O</span>
                </button>
                {(wsConfig.data?.recent ?? []).filter((r) => r !== workspace.data?.root).length > 0 && (
                  <div className="mt-1 border-t border-ink-700 pt-1">
                    <div className="px-3 py-0.5 text-[10px] uppercase tracking-wider text-ink-500">Recent</div>
                    {(wsConfig.data?.recent ?? [])
                      .filter((r) => r !== workspace.data?.root)
                      .slice(0, 6)
                      .map((r) => (
                        <button
                          key={r}
                          onClick={() => void switchVault(r)}
                          className="block w-full truncate px-3 py-1 text-left text-[12px] text-ink-300 hover:bg-ink-700 hover:text-ink-100"
                          title={r}
                        >
                          {r.replace(/^\/Users\/[^/]+/, "~")}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* cwd */}
        {activeTab?.cwdLive && (
          <button
            title="Reveal in file tree"
            onClick={() => {
              if (!activeTab.cwdLive!.outside && activeTab.cwdLive!.cwd) {
                setSidebarMode("files");
                revealPath(activeTab.cwdLive!.cwd);
              }
            }}
            className="shrink-0 truncate text-ink-300 hover:text-accent"
          >
            ❯ {activeTab.cwdLive.outside
              ? `${activeTab.cwdLive.cwd} (outside)`
              : `./${activeTab.cwdLive.cwd}`}
          </button>
        )}

        {/* git branch + dirty count */}
        {gitStatus.data?.repo && (
          <button
            onClick={() => setSidebarMode("git")}
            className="shrink-0 hover:text-accent"
            title="Source Control"
          >
            ⎇ {gitStatus.data.branch}
            {dirtyCount > 0 && <span className="ml-1 text-yellow-500">±{dirtyCount}</span>}
          </button>
        )}

        <button
          onClick={() => setPaletteOpen(true)}
          className="ml-auto shrink-0 rounded px-1.5 text-ink-500 hover:text-accent"
          title="Command palette"
        >
          ⌘K
        </button>
      </div>

      <CommandPalette
        open={paletteOpen}
        mode={paletteMode}
        onClose={() => setPaletteOpen(false)}
        onRunWorkflow={handleRunWorkflow}
      />
      <WorkflowSaveModal />
      <WorkflowRunModal workflow={runWorkflow} onClose={() => setRunWorkflow(null)} />

      {vaultPickerOpen && (
        <VaultPicker
          recent={wsConfig.data?.recent ?? []}
          currentRoot={workspace.data?.root}
          onClose={() => setVaultPickerOpen(false)}
          onPick={switchVault}
        />
      )}
      {wsConfig.data && !wsConfig.data.onboarded && (
        <WelcomeOverlay
          workspaceName={workspace.data?.name}
          onOpenVaultPicker={() => setVaultPickerOpen(true)}
          onDismiss={() => {
            void api.setOnboarded();
            void queryClient.invalidateQueries({ queryKey: ["workspace", "config"] });
          }}
        />
      )}
    </div>
  );
}

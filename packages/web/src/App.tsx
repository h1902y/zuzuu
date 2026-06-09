import { useEffect, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./lib/api";
import { fsEvents } from "./lib/fs-events";
import { useSessions } from "./state/sessions";
import { FileTree } from "./explorer/FileTree";
import { TermView } from "./term/TermView";

export default function App() {
  const queryClient = useQueryClient();
  const { tabs, activeId, init, create, close, setActive } = useSessions();
  const [initError, setInitError] = useState<string | null>(null);

  const workspace = useQuery({ queryKey: ["workspace"], queryFn: api.workspace });

  useEffect(() => {
    init().catch((err: Error) => setInitError(err.message));
  }, [init]);

  useEffect(() => {
    if (!workspace.data) return;
    fsEvents.start((path) => {
      void queryClient.invalidateQueries({ queryKey: ["dir", path] });
    });
  }, [workspace.data, queryClient]);

  const activeTab = tabs.find((t) => t.id === activeId);
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

  return (
    <div className="flex h-full flex-col">
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize="22%" minSize="160px" maxSize="45%" className="bg-ink-900">
          <FileTree />
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
              <div className="flex h-full items-center justify-center text-ink-500">
                <button onClick={() => void create()} className="rounded border border-ink-700 px-4 py-2 hover:border-accent-dim hover:text-ink-100">
                  open a terminal
                </button>
              </div>
            )}
          </div>
        </Panel>
      </Group>
      {/* status bar */}
      <div className="flex items-center gap-3 border-t border-ink-700 bg-ink-900 px-3 py-1 text-[11px] text-ink-500">
        <span className="text-accent-dim">❯_ webcode</span>
        <span className="truncate">{workspace.data?.root}</span>
        <span className="ml-auto">{tabs.filter((t) => t.alive).length} session(s)</span>
      </div>
    </div>
  );
}

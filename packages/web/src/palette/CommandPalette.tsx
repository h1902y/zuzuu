import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useQuery } from "@tanstack/react-query";
import type { Workflow } from "@webcode/protocol";
import { api } from "../lib/api";
import { useSessions } from "../state/sessions";
import { useExplorer } from "../state/explorer";
import { useBlocks } from "../state/blocks";
import { termRegistry } from "../term/registry";

/**
 * ⌘K fuzzy launcher over data webcode already has: files, command history
 * (from the block model), workspace search, sessions, and saved workflows.
 */
export function CommandPalette({
  open,
  onClose,
  onRunWorkflow,
}: {
  open: boolean;
  onClose: () => void;
  onRunWorkflow: (wf: Workflow) => void;
}) {
  const [searchValue, setSearchValue] = useState("");
  const openPreviewPath = useExplorer((s) => s.openPreviewPath);
  const setSidebarMode = useExplorer((s) => s.setSidebarMode);
  const history = useBlocks((s) => s.history);
  const { tabs, activeId, setActive, create } = useSessions();

  const files = useQuery({
    queryKey: ["files"],
    queryFn: api.listFiles,
    enabled: open,
    staleTime: 30_000,
  });
  const workflows = useQuery({
    queryKey: ["workflows"],
    queryFn: api.listWorkflows,
    enabled: open,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!open) setSearchValue("");
  }, [open]);

  if (!open) return null;

  const run = (fn: () => void) => {
    fn();
    onClose();
  };
  const sendToTerminal = (cmd: string) =>
    termRegistry.get(activeId)?.sendInput(`\x15${cmd}\r`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]"
      onClick={onClose}
    >
      <Command
        label="Command palette"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        loop
      >
        <Command.Input
          autoFocus
          value={searchValue}
          onValueChange={setSearchValue}
          placeholder="Jump to file, run a command, search…"
          className="w-full border-b border-ink-700 bg-transparent px-4 py-3 text-[13px] text-ink-100 placeholder:text-ink-500 focus:outline-none"
        />
        <Command.List className="max-h-[50vh] overflow-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-center text-[12px] text-ink-500">
            no matches
          </Command.Empty>

          {searchValue.trim().length >= 2 && (
            <Command.Group heading="Search">
              <Item
                onSelect={() =>
                  run(() => {
                    setSidebarMode("search");
                    // SearchPanel reads its own input; nudge via clipboard-free path:
                    window.dispatchEvent(
                      new CustomEvent("webcode:search", { detail: searchValue.trim() }),
                    );
                  })
                }
              >
                <Kind>search</Kind> "{searchValue.trim()}" in workspace
              </Item>
            </Command.Group>
          )}

          {history.length > 0 && (
            <Command.Group heading="History">
              {history.slice(0, 8).map((cmd, i) => (
                <Item key={`h-${i}`} value={`history ${cmd}`} onSelect={() => run(() => sendToTerminal(cmd))}>
                  <Kind>run</Kind> {cmd}
                </Item>
              ))}
            </Command.Group>
          )}

          {(workflows.data?.workflows.length ?? 0) > 0 && (
            <Command.Group heading="Workflows">
              {workflows.data!.workflows.map((wf) => (
                <Item key={`w-${wf.name}`} value={`workflow ${wf.name} ${wf.command}`} onSelect={() => run(() => onRunWorkflow(wf))}>
                  <Kind>flow</Kind> {wf.name}
                  <span className="ml-2 truncate text-ink-500">{wf.description ?? wf.command}</span>
                </Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading="Files">
            {(files.data?.files ?? []).slice(0, 500).map((f) => (
              <Item key={`f-${f}`} value={`file ${f}`} onSelect={() => run(() => openPreviewPath(f))}>
                <Kind>file</Kind> {f}
              </Item>
            ))}
          </Command.Group>

          <Command.Group heading="Sessions">
            {tabs.map((t) => (
              <Item key={`s-${t.id}`} value={`session ${t.title} ${t.id}`} onSelect={() => run(() => setActive(t.id))}>
                <Kind>term</Kind> {t.title}
                {t.id === activeId && <span className="ml-2 text-accent-dim">active</span>}
              </Item>
            ))}
            <Item value="new terminal session" onSelect={() => run(() => void create())}>
              <Kind>term</Kind> New terminal
            </Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

function Item({
  children,
  value,
  onSelect,
}: {
  children: React.ReactNode;
  value?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-1 truncate rounded px-2 py-1.5 text-[12.5px] text-ink-100 data-[selected=true]:bg-ink-700/70"
    >
      {children}
    </Command.Item>
  );
}

function Kind({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1 shrink-0 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-400">
      {children}
    </span>
  );
}

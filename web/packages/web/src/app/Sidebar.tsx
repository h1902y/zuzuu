// The left rail, calm two-tier (file-tree-workspace-nav brief): a workspace
// identity row + popover up top, then a quiet porcelain-verb group (Files /
// Search, with the new-file/new-folder affordances on hover), then the five
// modules as tall calm section rows (icon-chip in the module hue, count badge,
// amber pill only when proposals await review), then the file tree / search
// panel below. Restyle only — every handler and data path is the existing one:
// the explorer search toggle, the create-and-rename flow, switchVault, and the
// right panel's openModule. No new daemon APIs.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ListResponse } from "@zuzuu-web/protocol";
import { api } from "../lib/api";
import { zuzuuApi } from "../lib/zuzuu-api";
import { useExplorer } from "../state/explorer";
import { useRightPanel } from "../state/right-panel";
import { FileTree } from "../explorer/FileTree";
import { SearchPanel } from "../explorer/SearchPanel";
import { ActionMenu, cx, Count, StatusPill, type MenuItem } from "../components/ui";
import { capRecents, tilde } from "../onboarding/vault-picker-logic";
import { MODULE_ORDER, cardStatus, moduleDisplay, moduleHue } from "../panel/kit";
import { useWorkspaceConfigQuery, useWorkspaceQuery } from "./queries";
import { switchVault } from "./vault";

// ── a calm porcelain verb / module row ──────────────────────────────────
function NavRow({
  label,
  iconPath,
  iconColor,
  iconChip,
  active,
  trailing,
  title,
  onClick,
}: {
  label: string;
  iconPath: string;
  /** stroke color for the leading icon (module hue for module rows) */
  iconColor?: string;
  /** wrap the icon in a soft hue chip (module rows only) */
  iconChip?: boolean;
  active?: boolean;
  trailing?: React.ReactNode;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      className={cx(
        "group/navrow relative flex min-h-8 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1 text-left transition-colors",
        active ? "bg-hover text-ink-100" : "text-ink-300 hover:bg-hover hover:text-ink-100",
      )}
    >
      {/* active row carries a single thin accent spine, never a full fill */}
      {active && <span aria-hidden className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent" />}
      {iconChip ? (
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px]"
          style={{
            background: `color-mix(in oklab, ${iconColor} 13%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${iconColor} 22%, transparent)`,
          }}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ color: iconColor }}>
            <path d={iconPath} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          style={iconColor ? { color: iconColor } : undefined}
        >
          <path d={iconPath} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span className="wc-sans min-w-0 flex-1 truncate text-ui">{label}</span>
      {trailing && <span className="flex shrink-0 items-center gap-1.5">{trailing}</span>}
    </button>
  );
}

// ── the workspace identity row + switcher popover ───────────────────────
function WorkspaceRow() {
  const queryClient = useQueryClient();
  const workspace = useWorkspaceQuery();
  const wsConfig = useWorkspaceConfigQuery();
  const [open, setOpen] = useState(false);
  const recents = capRecents(wsConfig.data?.recent ?? [], workspace.data?.root, 6);

  const pick = (path: string) => {
    setOpen(false);
    void switchVault(queryClient, path);
  };
  const addFolder = () => {
    setOpen(false);
    window.dispatchEvent(new Event("zuzuu-web:open-vault-picker"));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={workspace.data?.root}
        className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors hover:bg-hover"
      >
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-hover text-ink-200"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1.5 4A1.5 1.5 0 013 2.5h3l1.5 1.5H13A1.5 1.5 0 0114.5 5.5v6A1.5 1.5 0 0113 13H3a1.5 1.5 0 01-1.5-1.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="wc-sans min-w-0 flex-1 truncate text-ui font-medium text-ink-100">
          {workspace.data?.name ?? "…"}
        </span>
        <svg viewBox="0 0 16 16" className={cx("h-3 w-3 shrink-0 text-ink-500 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            style={{ boxShadow: "var(--shadow-menu)" }}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-[var(--radius-ui)] border border-border bg-elevated py-1"
          >
            <div className="px-3 pb-1 pt-1">
              <div className="wc-eyebrow">Workspace</div>
              <div className="wc-sans mt-0.5 truncate text-ui text-ink-100" title={workspace.data?.root}>
                {workspace.data?.name ?? "…"}
              </div>
            </div>
            {recents.length > 0 && (
              <div className="mt-1 border-t border-border pt-1">
                <div className="wc-eyebrow px-3 py-0.5">Recent</div>
                {recents.map((r) => (
                  <button
                    key={r}
                    onClick={() => pick(r)}
                    title={r}
                    className="wc-sans block w-full truncate px-3 py-1.5 text-left text-ui text-ink-300 transition-colors hover:bg-hover hover:text-ink-100"
                  >
                    {tilde(r)}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-1 border-t border-border pt-1">
              <button
                onClick={addFolder}
                className="wc-sans flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-ink-200 transition-colors hover:bg-hover hover:text-ink-100"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
                </svg>
                Add folder…
                <span className="ml-auto text-meta text-ink-500">⌘⇧O</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar() {
  const queryClient = useQueryClient();
  const searchOpen = useExplorer((s) => s.searchOpen);
  const openSearch = useExplorer((s) => s.openSearch);
  const closeSearch = useExplorer((s) => s.closeSearch);
  const openModule = useRightPanel((s) => s.openModule);
  const drill = useRightPanel((s) => s.drill);
  const activeModule = drill?.kind === "module" ? drill.key : null;

  // the five modules' counts/pending — the SAME batched overview query the
  // panel reads (shared cache key, no extra daemon spawn, no new wiring)
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: zuzuuApi.overview, refetchInterval: 8000 });
  const entries = overview.data?.modules ?? [];

  // Create a file or folder in the selected dir (or workspace root) with a
  // default name, then drop the tree row straight into inline-rename so the
  // user edits the name + extension in place (no upfront prompt).
  const targetDir = () => {
    const sel = useExplorer.getState().selected;
    return sel ? (sel.includes(".") ? sel.split("/").slice(0, -1).join("/") : sel) : "";
  };
  const uniqueName = (dir: string, base: string, ext: string) => {
    const list = queryClient.getQueryData<ListResponse>(["dir", dir]);
    const taken = new Set((list?.entries ?? []).map((e) => e.name));
    let name = `${base}${ext}`;
    for (let i = 1; taken.has(name); i++) name = `${base}-${i}${ext}`;
    return name;
  };
  const createAndRename = async (dir: string, name: string, mk: (path: string) => Promise<unknown>) => {
    const path = dir ? `${dir}/${name}` : name;
    await mk(path);
    if (dir) useExplorer.getState().revealPath(`${dir}/x`); // expand the dir
    await queryClient.invalidateQueries({ queryKey: ["dir", dir] });
    useExplorer.getState().select(path);
    useExplorer.getState().setRenaming(path);
  };
  const newFile = () => {
    const dir = targetDir();
    return createAndRename(dir, uniqueName(dir, "untitled", ".md"), (p) => api.writeFile(p, ""));
  };
  const newFolder = () => {
    const dir = targetDir();
    return createAndRename(dir, uniqueName(dir, "untitled", ""), (p) => api.mkdir(p));
  };
  const newMenu: MenuItem[] = [
    { label: "New file", iconPath: "M4 1.5h5L13 5.5v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-12a1 1 0 011-1zM9 2v4h4", onClick: () => void newFile() },
    { label: "New folder", iconPath: "M1.5 3.5A1.5 1.5 0 013 2h3l1.5 1.5H13A1.5 1.5 0 0114.5 5v7A1.5 1.5 0 0113 13.5H3A1.5 1.5 0 011.5 12z", onClick: () => void newFolder() },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* tier 0 — workspace identity + switcher */}
      <div className="px-2 pt-2">
        <WorkspaceRow />
      </div>

      {/* tier 1 — quiet porcelain verbs */}
      <div className="mt-1 flex flex-col gap-0.5 px-2">
        <NavRow
          label="Files"
          iconPath="M1.5 4A1.5 1.5 0 013 2.5h3l1.5 1.5H13A1.5 1.5 0 0114.5 5.5v6A1.5 1.5 0 0113 13H3a1.5 1.5 0 01-1.5-1.5z"
          active={!searchOpen}
          onClick={() => closeSearch()}
          trailing={
            <span className="flex items-center opacity-0 transition-opacity group-hover/navrow:opacity-100">
              <ActionMenu items={newMenu} title="New file or folder" iconPath="M8 3v10M3 8h10" />
            </span>
          }
        />
        <NavRow
          label="Search"
          iconPath="M10.5 10.5L14 14M7 12A5 5 0 117 2a5 5 0 010 10z"
          active={searchOpen}
          title="Search workspace (⌘F)"
          onClick={() => (searchOpen ? closeSearch() : openSearch())}
        />
      </div>

      {/* tier 2 — the five modules as calm section rows */}
      <div className="mt-3 px-2">
        <div className="wc-eyebrow px-2 pb-1">Faculties</div>
        <div className="flex flex-col gap-0.5">
          {MODULE_ORDER.map((id) => {
            const entry = entries.find((e) => e.id === id);
            const display = moduleDisplay(id, entry);
            const count = entry?.counts.items ?? 0;
            const pending = entry?.counts.pending ?? 0;
            const status = cardStatus(count, pending);
            return (
              <NavRow
                key={id}
                label={display.label}
                iconPath={display.icon}
                iconColor={moduleHue(id)}
                iconChip
                active={activeModule === id}
                title={pending > 0 ? `${display.label} — ${pending} pending review` : `Open ${display.label}`}
                onClick={() => openModule(id)}
                trailing={
                  status === "pending" ? (
                    <StatusPill tone="warn">{pending} pending</StatusPill>
                  ) : count > 0 ? (
                    <Count>{count}</Count>
                  ) : null
                }
              />
            );
          })}
        </div>
      </div>

      {/* tier 3 — the tree (or the workspace search panel) */}
      <div className="mt-3 min-h-0 flex-1 border-t border-border pt-1">
        {searchOpen ? <SearchPanel /> : <FileTree />}
      </div>
    </div>
  );
}

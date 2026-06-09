import { useMemo, useRef, type DragEvent } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FsEntry, ListResponse } from "@webcode/protocol";
import { api } from "../lib/api";
import { useExplorer } from "../state/explorer";
import { useSessions } from "../state/sessions";

interface Row {
  path: string;
  name: string;
  depth: number;
  isDir: boolean;
  isSymlink: boolean;
  expanded: boolean;
}

const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

function buildRows(
  dirData: Map<string, ListResponse | undefined>,
  expanded: Set<string>,
): Row[] {
  const rows: Row[] = [];
  const walk = (dir: string, depth: number) => {
    const data = dirData.get(dir);
    if (!data) return;
    for (const entry of data.entries) {
      const path = join(dir, entry.name);
      const isDir = entry.kind === "dir" || entry.targetKind === "dir";
      const isExpanded = isDir && expanded.has(path);
      rows.push({
        path,
        name: entry.name,
        depth,
        isDir,
        isSymlink: entry.kind === "symlink",
        expanded: isExpanded,
      });
      if (isExpanded) walk(path, depth + 1);
    }
  };
  walk("", 0);
  return rows;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      fill="currentColor"
    >
      <path d="M6 4l4 4-4 4V4z" />
    </svg>
  );
}

function EntryIcon({ row }: { row: Row }) {
  if (row.isDir)
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-accent-dim" fill="currentColor">
        <path d="M1.5 3.5A1.5 1.5 0 013 2h3l1.5 1.5H13A1.5 1.5 0 0114.5 5v7A1.5 1.5 0 0113 13.5H3A1.5 1.5 0 011.5 12v-8.5z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-ink-500" fill="currentColor">
      <path d="M4 1.5h5L13 5.5v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-12a1 1 0 011-1zM9 2v4h4" fillRule="evenodd" />
    </svg>
  );
}

export function FileTree() {
  const queryClient = useQueryClient();
  const { expanded, selected, toggle, select } = useExplorer();
  const createSession = useSessions((s) => s.create);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dirPaths = useMemo(() => ["", ...expanded].sort(), [expanded]);

  const queries = useQueries({
    queries: dirPaths.map((path) => ({
      queryKey: ["dir", path],
      queryFn: () => api.listDir(path),
    })),
  });

  const dirData = useMemo(() => {
    const map = new Map<string, ListResponse | undefined>();
    dirPaths.forEach((path, i) => map.set(path, queries[i]?.data));
    return map;
  }, [dirPaths, queries]);

  const rows = useMemo(() => buildRows(dirData, expanded), [dirData, expanded]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  const refreshDir = (dir: string) =>
    queryClient.invalidateQueries({ queryKey: ["dir", dir] });

  const parentOf = (path: string) => path.split("/").slice(0, -1).join("/");

  const selectedDir = useMemo(() => {
    if (!selected) return "";
    const row = rows.find((r) => r.path === selected);
    if (row?.isDir) return selected;
    return parentOf(selected);
  }, [selected, rows]);

  // ── actions ────────────────────────────────────────────────────────
  const onNewFolder = async () => {
    const name = window.prompt("New folder name:");
    if (!name) return;
    await api.mkdir(join(selectedDir, name));
    void refreshDir(selectedDir);
  };

  const onRename = async (row: Row) => {
    const name = window.prompt("Rename to:", row.name);
    if (!name || name === row.name) return;
    await api.rename(row.path, join(parentOf(row.path), name));
    void refreshDir(parentOf(row.path));
  };

  const onDelete = async (row: Row) => {
    if (!window.confirm(`Delete ${row.name}${row.isDir ? " and its contents" : ""}?`)) return;
    await api.remove([row.path]);
    select(null);
    void refreshDir(parentOf(row.path));
  };

  const onDownload = (row: Row) => {
    const a = document.createElement("a");
    a.href = api.downloadUrl(row.path);
    a.download = row.name;
    a.click();
  };

  const uploadFiles = async (files: FileList | File[]) => {
    for (const file of files) {
      try {
        await api.upload(selectedDir, file);
      } catch (err) {
        if ((err as { status?: number }).status === 409 && window.confirm(`${file.name} exists — overwrite?`)) {
          await api.upload(selectedDir, file, true);
        }
      }
    }
    void refreshDir(selectedDir);
  };

  const onDrop = (ev: DragEvent) => {
    ev.preventDefault();
    if (ev.dataTransfer.files.length > 0) void uploadFiles(ev.dataTransfer.files);
  };

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-1 border-b border-ink-700 px-2 py-1.5 text-ink-300">
        <span className="mr-auto truncate text-[11px] uppercase tracking-wider">Files</span>
        <ToolbarButton title="New folder" onClick={onNewFolder} d="M8 4v8M4 8h8" />
        <ToolbarButton title="Upload" onClick={() => fileInputRef.current?.click()} d="M8 12V4m0 0L5 7m3-3l3 3M3 13h10" />
        <ToolbarButton title="Refresh" onClick={() => queryClient.invalidateQueries({ queryKey: ["dir"] })} d="M13 8a5 5 0 11-1.5-3.5M13 3v2.5h-2.5" />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto py-1">
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index]!;
            const isSelected = selected === row.path;
            return (
              <div
                key={row.path}
                className={`group absolute left-0 top-0 flex w-full cursor-default items-center gap-1.5 px-2 ${
                  isSelected ? "bg-ink-700/70" : "hover:bg-ink-800"
                }`}
                style={{
                  height: vi.size,
                  transform: `translateY(${vi.start}px)`,
                  paddingLeft: 8 + row.depth * 14,
                }}
                onClick={() => {
                  select(row.path);
                  if (row.isDir) toggle(row.path);
                }}
                onDoubleClick={() => {
                  if (!row.isDir) onDownload(row);
                }}
              >
                {row.isDir ? (
                  <Chevron open={row.expanded} />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <EntryIcon row={row} />
                <span className="truncate text-[12.5px] text-ink-100">
                  {row.name}
                  {row.isSymlink && <span className="ml-1 text-ink-500">⤳</span>}
                </span>
                <span className="ml-auto hidden shrink-0 items-center gap-1 group-hover:flex">
                  {row.isDir && (
                    <RowButton title="Open terminal here" onClick={() => void createSession(row.path)} d="M3 4l4 4-4 4M8 12h5" />
                  )}
                  <RowButton title="Download" onClick={() => onDownload(row)} d="M8 3v7m0 0L5 7m3 3l3-3M3 13h10" />
                  <RowButton title="Rename" onClick={() => void onRename(row)} d="M11 3l2 2-7 7H4v-2l7-7z" />
                  <RowButton title="Delete" onClick={() => void onDelete(row)} d="M4 5h8m-7 0v7m3-7v7m3-7v7M6 5V3h4v2" danger />
                </span>
              </div>
            );
          })}
        </div>
        {rows.length === 0 && (
          <div className="px-3 py-2 text-[12px] text-ink-500">empty workspace</div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ title, onClick, d }: { title: string; onClick: () => void; d: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-1 text-ink-300 hover:bg-ink-700 hover:text-ink-100"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d={d} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function RowButton({
  title,
  onClick,
  d,
  danger,
}: {
  title: string;
  onClick: () => void;
  d: string;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded p-0.5 ${danger ? "text-ink-500 hover:text-danger" : "text-ink-500 hover:text-ink-100"}`}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d={d} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

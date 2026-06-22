// src/client/explorer/FileTree.tsx — the lazy file tree.
//
// Children are fetched on first expand (api.listDir) and cached; the daemon's
// /ws/fs events invalidate a directory when its contents change, so the tree
// stays live without polling. Rung 4 lists + navigates; opening a file into the
// editor/preview pane lands in Rung 5.

import { useCallback, useEffect, useRef, useState } from "react";
import type { FsEntry } from "#shared/index.js";
import { api } from "../lib/api.js";
import { fsEvents } from "../lib/fs-events.js";

const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

export function FileTree({ onOpenFile }: { onOpenFile?: (path: string) => void }) {
  // path → its entries (undefined = not loaded yet)
  const [children, setChildren] = useState<Record<string, FsEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const childrenRef = useRef(children);
  childrenRef.current = children;

  const load = useCallback(async (dir: string) => {
    const res = await api.listDir(dir).catch(() => null);
    if (res) setChildren((c) => ({ ...c, [dir]: sortEntries(res.entries) }));
  }, []);

  // initial root + live invalidation
  useEffect(() => {
    void load("");
    fsEvents.start((path) => {
      // only refetch a directory we've actually loaded
      if (path in childrenRef.current) void load(path);
    });
  }, [load]);

  const toggle = (dir: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
        fsEvents.unwatch(dir);
      } else {
        next.add(dir);
        fsEvents.watch(dir);
        if (!(dir in childrenRef.current)) void load(dir);
      }
      return next;
    });
  };

  const rows: React.ReactElement[] = [];
  const walk = (dir: string, depth: number) => {
    for (const e of children[dir] ?? []) {
      const path = join(dir, e.name);
      const isDir = e.kind === "dir" || (e.kind === "symlink" && e.targetKind === "dir");
      const open = expanded.has(path);
      rows.push(
        <button
          key={path}
          onClick={() => (isDir ? toggle(path) : onOpenFile?.(path))}
          className="flex w-full items-center gap-1 truncate px-2 py-[3px] text-left text-ui hover:bg-hover"
          style={{ paddingLeft: depth * 12 + 8 }}
          title={path}
        >
          <span className="w-3 shrink-0 text-muted">{isDir ? (open ? "▾" : "▸") : ""}</span>
          <span className={isDir ? "font-sans" : "font-mono text-subtle"}>{e.name}</span>
        </button>,
      );
      if (isDir && open) walk(path, depth + 1);
    }
  };
  walk("", 0);

  return <div className="select-none overflow-y-auto py-1">{rows}</div>;
}

/** dirs first, then files, each alphabetical (case-insensitive). */
function sortEntries(entries: FsEntry[]): FsEntry[] {
  return [...entries].sort((a, b) => {
    const ad = a.kind === "dir" ? 0 : 1;
    const bd = b.kind === "dir" ? 0 : 1;
    return ad - bd || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

// src/client/app/Sidebar.tsx — the left workspace panel: Files ⇆ Search.
//
// A two-tab switch over the explorer. Deliberately thin; the right panel
// (modules dashboard / editor) is a separate surface that lands in Rung 5.

import { useState } from "react";
import { FileTree } from "../explorer/FileTree.js";
import { SearchPanel } from "../explorer/SearchPanel.js";

type Tab = "files" | "search";

export function Sidebar({ onOpenFile }: { onOpenFile?: (path: string) => void }) {
  const [tab, setTab] = useState<Tab>("files");
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-[var(--height-bar)] shrink-0 items-stretch border-b border-border">
        {(["files", "search"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 text-meta uppercase tracking-wide ${
              tab === t ? "border-b-2 border-accent text-ink-100" : "text-muted hover:text-subtle"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "files" ? <FileTree onOpenFile={onOpenFile} /> : <SearchPanel onOpenFile={onOpenFile} />}
      </div>
    </div>
  );
}

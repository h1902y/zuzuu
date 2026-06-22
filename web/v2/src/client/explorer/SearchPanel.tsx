// src/client/explorer/SearchPanel.tsx — ripgrep search over the workspace.
//
// Debounced query → /api/search (rg, grep fallback). The pure bits (the 2-char
// floor, the trim-shift of highlight offsets) live in search-logic.ts so they're
// testable without a DOM.

import { useEffect, useState } from "react";
import type { SearchResponse } from "#shared/index.js";
import { api } from "../lib/api.js";
import { canSearch, shiftRanges } from "./search-logic.js";

export function SearchPanel({ onOpenFile }: { onOpenFile?: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canSearch(query)) {
      setRes(null);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await api.search(query).catch(() => null);
      if (live) {
        setRes(r);
        setBusy(false);
      }
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files…"
          className="w-full rounded-ui bg-elevated px-2 py-1 font-mono text-ui outline-none placeholder:text-muted"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {busy && <div className="px-2 py-1 text-meta text-muted">searching…</div>}
        {res && (
          <div className="px-2 py-1 text-meta text-muted">
            {res.total} match{res.total === 1 ? "" : "es"} · {res.engine}
            {res.truncated ? " (truncated)" : ""}
          </div>
        )}
        {res?.results.map((file) => (
          <div key={file.path} className="mb-1">
            <button
              onClick={() => onOpenFile?.(file.path)}
              className="block w-full truncate px-2 py-[2px] text-left font-mono text-ui text-subtle hover:bg-hover"
              title={file.path}
            >
              {file.path}
            </button>
            {file.matches.map((m, i) => (
              <Hit key={i} text={m.text} ranges={shiftRanges(m)} line={m.line} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Hit({ text, ranges, line }: { text: string; ranges: [number, number][]; line: number }) {
  const trimmed = text.trimStart();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [s, e] of ranges) {
    if (s > cursor) parts.push(trimmed.slice(cursor, s));
    parts.push(<mark key={s} className="bg-accent-dim text-ink-100">{trimmed.slice(s, e)}</mark>);
    cursor = e;
  }
  parts.push(trimmed.slice(cursor));
  return (
    <div className="flex gap-2 truncate px-3 py-[1px] font-mono text-meta">
      <span className="w-8 shrink-0 text-right text-muted">{line}</span>
      <span className="truncate">{parts}</span>
    </div>
  );
}

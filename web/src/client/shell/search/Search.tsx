// shell/search/Search.tsx — the brain content-results view (U4). No longer a top-level
// nav destination: reached only via the ⌘K "see all results" action, seeded with that
// query. Aggregates every module's notes (overview → per-module detail) and filters them
// client-side via searchNotes (tested). A hit opens its record; the header dismiss
// restores the prior node (the SPA has no browser history). Thin .tsx; static utilities only.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X } from "lucide-react";
import { api } from "../../lib/api.js";
import { searchNotes } from "./search-notes.js";
import { useWorld } from "../world-state.js";
import { Stack, Inline, Text, Icon, Loading } from "../../ds/index.js";

export function Search() {
  const selected = useWorld((s) => s.selected);
  const prev = useWorld((s) => s.prev);
  const select = useWorld((s) => s.select);
  // Seed from the incoming ⌘K query and re-sync when a fresh "see all results" fires,
  // so a new query updates this view in place rather than stacking a navigation entry.
  const incoming = selected?.kind === "search" ? selected.query ?? "" : "";
  const [query, setQuery] = useState(incoming);
  useEffect(() => { setQuery(incoming); }, [incoming]);
  const dismiss = () => select(prev && prev.kind !== "search" ? prev : { kind: "overview" });
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const ids = (overview.data?.modules ?? []).map((m) => m.id);
  const details = useQuery({
    queryKey: ["zuzuu", "all-notes", ids],
    enabled: ids.length > 0,
    queryFn: async () => (await Promise.all(ids.map((id) => api.zuzuu.module(id)))).flatMap((d) => d.items),
  });

  const items = details.data ?? [];
  const hits = searchNotes(items, query);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-8 py-5">
        <div className="mx-auto w-full max-w-3xl">
          <Inline gap="sm" align="center">
            <label className="flex flex-1 items-center gap-3 rounded-ui border border-border bg-surface px-4 py-3">
              <Icon icon={SearchIcon} size={18} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search every note in the brain…"
                className="min-w-0 flex-1 bg-transparent text-base text-ink-100 outline-none placeholder:text-muted"
              />
            </label>
            <Text as="button" interactive size="meta" tone="muted" onClick={dismiss}>
              <Inline gap="xs" align="center"><Icon icon={X} size={14} /> Close</Inline>
            </Text>
          </Inline>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto w-full max-w-3xl">
          {details.isLoading ? (
            <Loading label="reading the brain…" />
          ) : !query.trim() ? (
            <Text size="ui" tone="muted">Type to search across {items.length} {items.length === 1 ? "note" : "notes"}.</Text>
          ) : !hits.length ? (
            <Text size="ui" tone="muted">No notes match “{query}”.</Text>
          ) : (
            <Stack gap="xs">
              <Text size="meta" tone="subtle" weight="semibold">{hits.length} {hits.length === 1 ? "RESULT" : "RESULTS"}</Text>
              {hits.map((h) => (
                <button
                  key={`${h.module}:${h.id}`}
                  type="button"
                  onClick={() => select({ kind: "row", id: h.id, module: h.module })}
                  className="w-full rounded-ui border border-transparent bg-surface px-5 py-4 text-left transition-colors hover:border-border hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
                >
                  <Stack gap="xs">
                    <Inline gap="sm">
                      <Text size="body" weight="medium" truncate>{h.title}</Text>
                      <Text size="meta" tone="muted">{h.module} · {h.kind}</Text>
                    </Inline>
                    {h.snippet && <Text size="meta" tone="muted">{h.snippet}</Text>}
                  </Stack>
                </button>
              ))}
            </Stack>
          )}
        </div>
      </div>
    </div>
  );
}

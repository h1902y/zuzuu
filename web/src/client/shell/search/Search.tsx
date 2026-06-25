// shell/search/Search.tsx — cross-note brain search (P3.2). Aggregates every module's
// notes (overview → per-module detail), then filters them client-side via searchNotes
// (tested). A hit opens its record. Thin .tsx; static utilities only.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { api } from "../../lib/api.js";
import { searchNotes } from "./search-notes.js";
import { useWorld } from "../world-state.js";
import { Stack, Inline, Text, Icon, Loading } from "../../ds/index.js";

export function Search() {
  const [query, setQuery] = useState("");
  const select = useWorld((s) => s.select);
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
          <label className="flex items-center gap-3 rounded-ui border border-border bg-surface px-4 py-3">
            <Icon icon={SearchIcon} size={18} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search every note in the brain…"
              className="min-w-0 flex-1 bg-transparent text-base text-ink-100 outline-none placeholder:text-muted"
            />
          </label>
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

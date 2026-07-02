// shell/stage/FilterChips.tsx — the module's active lens, named above the Map.
//
// When the shared module filter is live and the Map projection is showing, most
// of the island is dimmed — this row says WHY (the filter chips) and offers the
// exit (clear). Without it a spotlighted map reads as data loss.
import { X } from "lucide-react";
import { useModuleFilter, filterOf, isFiltering } from "../../state/module-filter.js";
import { Text, Icon } from "../../ds/index.js";

export function FilterChips({ module }: { module: string }) {
  const filter = useModuleFilter((s) => filterOf(s.byModule, module));
  const clear = useModuleFilter((s) => s.clear);
  if (!isFiltering(filter)) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-6 py-2">
      <Text size="meta" tone="muted">spotlight</Text>
      {filter.text.trim() && (
        <span className="rounded-ui border border-border bg-app px-2 py-0.5 text-meta text-subtle">
          “{filter.text.trim()}”
        </span>
      )}
      {filter.kind && (
        <span className="rounded-ui border border-border bg-app px-2 py-0.5 text-meta text-subtle">
          type: {filter.kind}
        </span>
      )}
      <button
        type="button"
        onClick={() => clear(module)}
        className="ml-1 inline-flex items-center gap-1 rounded-ui px-2 py-0.5 text-meta text-muted transition-colors hover:bg-hover hover:text-ink-100"
      >
        <Icon icon={X} size={12} /> clear
      </button>
    </div>
  );
}

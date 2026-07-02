// shell/stage/FacetChip.tsx — a facet row's chip (§H.3.1: "facets are just
// SUGGESTED clauses — clicking a facet = typing its clause"). Shared by the
// module/type/status facet rows on both the unified Everything table and the
// per-module Grid (status/type), so the row look is identical everywhere.
export function ModuleDot({ color }: { color?: string }) {
  return (
    <svg aria-hidden width="8" height="8" className="shrink-0">
      <circle cx="4" cy="4" r="4" fill={color ?? "currentColor"} />
    </svg>
  );
}

export function FacetChip({ label, active, dot, onClick }: { label: string; active: boolean; dot?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-ui border px-2 py-0.5 text-meta transition-colors ${active ? "border-accent-dim bg-selected text-ink-100" : "border-border bg-app text-subtle hover:bg-hover hover:text-ink-100"}`}
    >
      {dot && <ModuleDot color={dot} />}
      {label}
    </button>
  );
}

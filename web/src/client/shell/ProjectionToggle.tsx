// shell/ProjectionToggle.tsx — the ONE always-visible projection control, in the top
// app header (beside the project breadcrumb). [Table · Map · Flow], active-state
// aware; the visible twin of `T` / `>table` / `>map` / `>flow`. One instance for the
// whole shell — the per-stage header strip is retired. Pure presentation over the
// projectionSwitch model (Table/Map) + the flow prop (§I rung 5 — Flow is a THIRD,
// orthogonal axis: it focuses a WORKFLOW NOTE, not a generic map/table scope, so it
// rides its own small prop rather than being folded into ProjTarget's scope/view
// shape — projectionSwitch's pinned {active,map,table} contract stays untouched).
import type { ProjectionSwitch, ProjTarget } from "./projection-switch.js";

export interface FlowToggleState {
  /** does the project have any `type: workflow` notes at all? */
  available: boolean;
  /** is the Flow stage the one currently showing? */
  active: boolean;
  onClick: () => void;
}

export function ProjectionToggle({ projection, onProject, flow }: {
  projection: ProjectionSwitch; onProject: (t: ProjTarget) => void; flow?: FlowToggleState;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-ui border border-border">
      <button
        type="button"
        onClick={() => onProject(projection.table)}
        aria-pressed={projection.active === "table"}
        title="Table (T · >table)"
        className={`px-2.5 py-1 text-meta transition-colors ${projection.active === "table" ? "bg-hover text-ink-100" : "text-muted hover:text-ink-100"}`}
      >
        Table
      </button>
      <button
        type="button"
        onClick={() => onProject(projection.map)}
        aria-pressed={projection.active === "map"}
        title="Map — the World (T · >map)"
        className={`border-l border-border px-2.5 py-1 text-meta transition-colors ${projection.active === "map" ? "bg-hover text-ink-100" : "text-muted hover:text-ink-100"}`}
      >
        Map
      </button>
      {flow && (
        <button
          type="button"
          onClick={flow.onClick}
          disabled={!flow.available}
          aria-pressed={flow.active}
          title={flow.available ? "Flow — a workflow's DAG + runs (>flow)" : "Flow — no workflows yet"}
          className={`border-l border-border px-2.5 py-1 text-meta transition-colors ${
            !flow.available ? "cursor-not-allowed text-subtle opacity-50" : flow.active ? "bg-hover text-ink-100" : "text-muted hover:text-ink-100"
          }`}
        >
          Flow
        </button>
      )}
    </div>
  );
}

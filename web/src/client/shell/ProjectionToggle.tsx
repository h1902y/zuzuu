// shell/ProjectionToggle.tsx — the ONE always-visible projection control, in the top
// app header (beside the project breadcrumb). [Table · Map], active-state aware; the
// visible twin of `T` / `>table` / `>map`. One instance for the whole shell — the
// per-stage header strip is retired. Pure presentation over the projectionSwitch model.
import type { ProjectionSwitch, ProjTarget } from "./projection-switch.js";

export function ProjectionToggle({ projection, onProject }: {
  projection: ProjectionSwitch; onProject: (t: ProjTarget) => void;
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
    </div>
  );
}

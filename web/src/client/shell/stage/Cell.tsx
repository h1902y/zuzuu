// shell/stage/Cell.tsx — renders one typed CellDescriptor (the visual half of
// grid-columns' describeCell). Shared by the grid cell and the record read-view so a
// value renders identically in both: mono ids/numbers · module-hue & status pills ·
// a bool glyph · plain text. Static, token-bound utilities only (guard-safe).
import { Chip } from "../../ds/index.js";
import type { CellDescriptor } from "./grid-columns.js";

export function Cell({ d }: { d: CellDescriptor }) {
  switch (d.kind) {
    case "empty": return <span className="text-muted">—</span>;
    case "mono": return <span className="font-mono text-subtle">{d.value}</span>;
    case "pill": return <Chip label={d.value} tone={d.tone} />;
    case "pills": return <span className="inline-flex flex-wrap gap-1">{d.values.map((v) => <Chip key={v} label={v} />)}</span>;
    case "bool": return d.value ? <span className="text-success">✓</span> : <span className="text-muted">—</span>;
    default: return <span className="text-subtle">{d.value}</span>;
  }
}

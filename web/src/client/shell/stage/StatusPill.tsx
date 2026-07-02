// shell/stage/StatusPill.tsx — the lifecycle pill (§H.4.4): seed/active/archived/
// deprecated get fixed semantic hues; anything else renders as a neutral pill.
// Token classes only (the inline-style ban holds); color rides a class map.
import { lifecycleTone } from "./table-model.js";

const TONE_CLASS: Record<string, string> = {
  seed: "border-info text-info",
  active: "border-success text-success",
  archived: "border-border text-muted",
  deprecated: "border-warning text-warning",
};

export function StatusPill({ status }: { status: string }) {
  if (!status) return null;
  const tone = lifecycleTone(status);
  const cls = tone ? TONE_CLASS[tone] : "border-border text-subtle";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-meta ${cls}`}>
      {status}
    </span>
  );
}

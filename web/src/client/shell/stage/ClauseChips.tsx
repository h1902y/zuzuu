// shell/stage/ClauseChips.tsx — the active filter state as dismissible chips
// (§H.3.1): "every active clause renders as a dismissible chip." Free text (FTS)
// gets one chip (dismiss = clear the search box); each `where` clause gets its
// own (dismiss = drop just that clause) — the typed input, a clicked attribute
// chip (§H.2), and the builder panels (§H.4.3) all land here identically, since
// they all write the SAME list-state.
import { X } from "lucide-react";
import { clauseParts } from "./table-model.js";
import { Icon } from "../../ds/index.js";

function Chip({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-ui border border-border bg-app px-2 py-0.5 text-meta text-subtle">
      {label}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`remove filter: ${label}`}
        className="text-muted transition-colors hover:text-ink-100"
      >
        <Icon icon={X} size={10} />
      </button>
    </span>
  );
}

export function ClauseChips({ text, where, onClearText, onRemoveWhere }: {
  text: string;
  where: readonly string[];
  onClearText: () => void;
  onRemoveWhere: (clause: string) => void;
}) {
  if (!text.trim() && !where.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-surface px-6 py-1.5">
      {text.trim() && <Chip label={`“${text.trim()}”`} onDismiss={onClearText} />}
      {where.map((w) => {
        const { key, op, value } = clauseParts(w);
        return <Chip key={w} label={op ? `${key} ${op} ${value}` : w} onDismiss={() => onRemoveWhere(w)} />;
      })}
    </div>
  );
}

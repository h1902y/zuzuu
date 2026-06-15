import { cx } from "../../components/ui";
import { kindIcon, relativeTime } from "./kit";

/** Small SVG path for the "open in editor" icon (external-link / arrow-up-right). */
const OPEN_IN_EDITOR_ICON = "M10 3h3v3M13 3l-6 6M6 5H4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-2";

/** The universal envelope-item row: kind icon · title (truncate) · status
 *  badge (pending = amber, archived = gray) · relative timestamp.
 *
 *  Primary affordance: `onClick` — the whole row click (e.g. inline expand toggle).
 *  Secondary affordance: `onOpenInEditor` — a small explicit icon button at the
 *    right edge that opens the file in the editor (distinct from the row click).
 *
 *  Without onClick, renders as a static preview div. Without onOpenInEditor,
 *  no secondary button is shown. */
export function ItemRow({
  kind,
  title,
  status,
  timestamp,
  onClick,
  onOpenInEditor,
  compact = false,
  titleAttr,
}: {
  kind: string | undefined;
  title: string;
  /** active | archived | pending (pending = a proposal awaiting review) */
  status?: string | undefined;
  /** ISO timestamp (updated_at ?? created_at) */
  timestamp?: string | null | undefined;
  /** Primary click — row-level action (e.g. inline expand toggle). */
  onClick?: (() => void) | undefined;
  /** Secondary: open the item's file in the editor. Shown as a small icon
   *  button at the right edge. Click does NOT bubble to the row. */
  onOpenInEditor?: (() => void) | undefined;
  compact?: boolean;
  titleAttr?: string | undefined;
}) {
  const rel = relativeTime(timestamp);
  const inner = (
    <>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d={kindIcon(kind)} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="min-w-0 truncate text-muted-foreground">{title}</span>
      {status === "pending" && (
        <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--color-status-pending)_16%,transparent)] px-1.5 text-meta leading-4 text-status-pending">
          pending
        </span>
      )}
      {status === "archived" && (
        <span className="shrink-0 rounded-full bg-[var(--accent)] px-1.5 text-meta leading-4 text-muted-foreground">archived</span>
      )}
      {rel && <span className={cx("shrink-0 text-meta text-muted-foreground", onOpenInEditor ? "" : "ml-auto")}>{rel}</span>}
      {onOpenInEditor && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenInEditor(); }}
          className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
          title="Open in editor"
          aria-label="Open in editor"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d={OPEN_IN_EDITOR_ICON} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </>
  );
  const layout = cx(
    "group flex w-full min-w-0 items-center gap-2 text-left text-ui",
    compact ? "py-0.5" : "border-b border-[var(--border)] py-1 last:border-0",
  );
  if (!onClick) return <div className={layout} title={titleAttr}>{inner}</div>;
  return (
    <button onClick={onClick} className={cx(layout, "transition-colors hover:bg-[var(--accent)]")} title={titleAttr}>
      {inner}
    </button>
  );
}

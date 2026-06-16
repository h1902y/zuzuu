// The center's session TAB STRIP (editor model) — the OPEN sessions, across the
// top of the center. Picker = all-sessions browser; this = what's open now.
// Reuses the Tab primitive (it already carries leading + onClose). Closing a tab
// removes it from the strip; it does NOT end the session (that's End/Stop).
import { Bar, StatusDot, TabBar, Tab, cx } from "../components/ui";
import type { OpenTabItem } from "./active-tab";

export function SessionTabStrip({
  items,
  activeId,
  onSelect,
  onClose,
}: {
  items: OpenTabItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Bar border="b" surface="app" className="!px-0">
      <TabBar className="overflow-x-auto">
        {items.map((it) => (
          <Tab
            key={it.id}
            active={it.id === activeId}
            onClick={() => onSelect(it.id)}
            onClose={() => onClose(it.id)}
            title={
              it.live
                ? `${it.label} — live`
                : it.outside
                  ? `${it.label} — running in your terminal`
                  : it.label
            }
            leading={<StatusDot tone={it.live ? "ok" : "idle"} pulse={it.live} />}
          >
            <span className="inline-flex items-baseline gap-1">
              {it.label}
              {it.outside && <span className={cx("text-meta text-muted-foreground")}>· outside</span>}
            </span>
          </Tab>
        ))}
      </TabBar>
    </Bar>
  );
}

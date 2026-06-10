import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  onClick: () => void;
  /** SVG path data for a 16×16 icon */
  iconPath?: string;
  danger?: boolean;
  /** render a divider above this item */
  separated?: boolean;
}

/**
 * A single ⋯ overflow button that opens a popover of actions. The same item
 * set can also be opened by right-clicking the host element (see useContextMenu).
 * Closes on outside-click and Escape.
 */
export function ActionMenu({
  items,
  className = "",
  title = "More actions",
}: {
  items: MenuItem[];
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`rounded px-1 text-ink-400 hover:bg-ink-700 hover:text-ink-100 ${className}`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
          <circle cx="3" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="13" cy="8" r="1.3" />
        </svg>
      </button>
      {open && <MenuPopover items={items} onClose={() => setOpen(false)} anchor="button" />}
    </div>
  );
}

/** The floating menu list. `anchor="button"` positions under a ⋯; coords position at a point. */
export function MenuPopover({
  items,
  onClose,
  anchor = "button",
  x,
  y,
}: {
  items: MenuItem[];
  onClose: () => void;
  anchor?: "button" | "point";
  x?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const positioned =
    anchor === "point"
      ? ({ position: "fixed", left: x, top: y } as const)
      : ({ position: "absolute", right: 0, top: "100%" } as const);

  return (
    <div
      ref={ref}
      style={positioned}
      onClick={(e) => e.stopPropagation()}
      className="z-50 mt-1 min-w-44 overflow-hidden rounded border border-ink-700 bg-ink-850 py-1 shadow-xl"
    >
      {items.map((item, i) => (
        <div key={item.label}>
          {item.separated && i > 0 && <div className="my-1 border-t border-ink-700" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
              onClose();
            }}
            className={`flex w-full items-center gap-2 px-3 py-1 text-left text-[12px] hover:bg-ink-700 ${
              item.danger ? "text-danger hover:text-danger" : "text-ink-200 hover:text-ink-100"
            }`}
          >
            {item.iconPath ? (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d={item.iconPath} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Wire right-click on a row to open the same item set as a point-anchored menu.
 * Returns an `onContextMenu` handler and the menu element to render.
 */
export function useContextMenu(items: MenuItem[]) {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPt({ x: e.clientX, y: e.clientY });
  };
  const menu = pt ? (
    <MenuPopover items={items} anchor="point" x={pt.x} y={pt.y} onClose={() => setPt(null)} />
  ) : null;
  return { onContextMenu, menu };
}

// The workbench shell: sidebar | session center | right panel, with the
// right panel collapsible to a thin rail.
import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

export function Layout({
  sidebar,
  center,
  right,
  rightCollapsed,
  onExpandRight,
}: {
  sidebar: ReactNode;
  center: ReactNode;
  right: ReactNode;
  rightCollapsed: boolean;
  onExpandRight: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1">
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize="22%" minSize="160px" maxSize="45%" className="bg-surface">
          {sidebar}
        </Panel>
        <Separator className="w-px bg-border transition-colors hover:bg-accent-dim" />
        <Panel className="flex min-w-0 flex-col">{center}</Panel>
        {/* the right panel: editor (files mode) or the modules surface */}
        {!rightCollapsed && (
          <>
            <Separator className="w-px bg-border transition-colors hover:bg-accent-dim" />
            <Panel id="right" defaultSize="30%" minSize="280px" className="min-w-0">
              {right}
            </Panel>
          </>
        )}
      </Group>
      {rightCollapsed && (
        <button
          onClick={onExpandRight}
          title="Show panel"
          className="flex w-6 shrink-0 items-center justify-center border-l border-border bg-surface text-ink-500 transition-colors hover:bg-hover hover:text-ink-100"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

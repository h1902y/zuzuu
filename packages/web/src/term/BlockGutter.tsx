import { useState } from "react";
import type { Terminal } from "@xterm/xterm";
import type { Block, BlockTracker } from "./blocks";

interface GutterMetrics {
  cellHeight: number;
  padTop: number;
  viewportY: number;
  rows: number;
}

/** Row height + top padding of the rendered xterm, for row→pixel mapping. */
export function readMetrics(term: Terminal, host: HTMLElement): GutterMetrics | null {
  const screen = host.querySelector(".xterm-screen") as HTMLElement | null;
  if (!screen || term.rows === 0) return null;
  const cellHeight = screen.clientHeight / term.rows;
  // xterm screen sits below the host's top padding
  const padTop = screen.getBoundingClientRect().top - host.getBoundingClientRect().top;
  return { cellHeight, padTop, viewportY: term.buffer.active.viewportY, rows: term.rows };
}

interface Props {
  term: Terminal;
  tracker: BlockTracker;
  host: HTMLElement;
  /** bumps on scroll/render to trigger recompute */
  tick: number;
  onReRun: (command: string) => void;
  onSaveWorkflow: (command: string) => void;
  /** send a command to the active PTY (kill-line prefixed + enter) */
  send: (command: string) => void;
}

export function BlockGutter({ term, tracker, host, tick, onReRun, onSaveWorkflow, send }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  void tick; // re-render dependency
  const metrics = readMetrics(term, host);
  if (!metrics) return null;
  const { cellHeight, padTop, viewportY, rows } = metrics;
  const viewBottom = viewportY + rows;

  const yOf = (row: number) => padTop + (row - viewportY) * cellHeight;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {tracker.list().map((block) => {
        const end = block.outputEnd ?? viewBottom;
        if (end < viewportY || block.outputStart > viewBottom) return null;
        const top = yOf(Math.max(block.outputStart, viewportY));
        const bottom = yOf(Math.min(end, viewBottom));
        const height = Math.max(2, bottom - top);
        const color =
          block.exitCode === null
            ? "bg-ink-500"
            : block.exitCode === 0
              ? "bg-accent-dim"
              : "bg-danger";
        return (
          <div
            key={block.id}
            className="pointer-events-auto absolute left-0 w-[3px] cursor-pointer transition-[width] hover:w-[5px]"
            style={{ top, height }}
            onMouseEnter={() => setHovered(block.id)}
            onMouseLeave={() => setHovered((h) => (h === block.id ? null : h))}
          >
            <div className={`h-full w-full rounded-r ${color}`} />
            {hovered === block.id && block.command && (
              <BlockActions
                block={block}
                onCopy={() => void navigator.clipboard.writeText(tracker.outputText(block))}
                onReRun={() => onReRun(block.command)}
                onSaveWorkflow={() => onSaveWorkflow(block.command)}
                onFix={() => block.fix?.run(send)}
              />
            )}
            {block.fix && hovered !== block.id && (
              <button
                onClick={() => block.fix!.run(send)}
                onMouseDown={(e) => e.preventDefault()}
                className="pointer-events-auto absolute left-2 top-0 flex items-center gap-1 whitespace-nowrap rounded border border-yellow-600/50 bg-ink-850 px-1.5 py-0.5 text-[10px] text-yellow-400 shadow-lg hover:border-yellow-500 hover:text-yellow-300"
                title="Quick fix"
              >
                <span>⚡</span> {block.fix.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BlockActions({
  block,
  onCopy,
  onReRun,
  onSaveWorkflow,
  onFix,
}: {
  block: Block;
  onCopy: () => void;
  onReRun: () => void;
  onSaveWorkflow: () => void;
  onFix: () => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute left-2 top-0 flex items-center gap-0.5 rounded border border-ink-700 bg-ink-850 px-1 py-0.5 shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="max-w-40 truncate px-1 text-[11px] text-ink-300" title={block.command}>
        {block.command.split("\n")[0]}
      </span>
      {block.durationMs !== null && block.durationMs > 200 && (
        <span className="px-0.5 text-[10px] text-ink-500">{fmtMs(block.durationMs)}</span>
      )}
      {block.fix && (
        <button
          onClick={onFix}
          title={`Quick fix: ${block.fix.label}`}
          className="rounded px-1 py-0.5 text-[11px] text-yellow-400 hover:bg-ink-700 hover:text-yellow-300"
        >
          ⚡ fix
        </button>
      )}
      <ActionBtn title="Copy output" onClick={onCopy} d="M6 6h7v7H6zM3 10V3h7" />
      <ActionBtn title="Re-run" onClick={onReRun} d="M13 8a5 5 0 11-1.5-3.5M13 3v2.5h-2.5" />
      <ActionBtn title="Save as workflow" onClick={onSaveWorkflow} d="M8 3v10M3 8h10" />
    </div>
  );
}

function ActionBtn({ title, onClick, d }: { title: string; onClick: () => void; d: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-0.5 text-ink-400 hover:bg-ink-700 hover:text-ink-100"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d={d} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

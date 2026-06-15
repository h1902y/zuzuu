// The terminal-native transcript (U7) — a real conversation log derived from
// the terminal + the captured trace, NEVER a chat/message protocol.
//
//   • SHELL sessions  → live OSC-133 command blocks (`useBlocks`), grouped into
//                       runs with timestamps + a run outcome; history = prior
//                       runs scrolled in place.
//   • AGENT sessions  → post-hoc trace actions (U6, `useSessionTraceQuery`);
//                       the terminal stays the LIVE conversation, so we render
//                       the captured record + a clear "live in the terminal"
//                       affordance, never a faked empty live thread.
//
// The terminal itself is untouched: this is a sibling read-model. The PTY hot
// path, reattach/replay and flow control are unchanged (KTD5/R7).
import { useQueryClient } from "@tanstack/react-query";
import { Receipt, Spinner, StatusDot, Button } from "../components/ui";
import { useSessionTraceQuery } from "../app/queries";
import { useBlocks } from "../state/blocks";
import {
  blockRows,
  traceRows,
  groupRuns,
  transcriptSourceFor,
  type ReceiptRow,
  type TranscriptRun,
} from "./transcript-model";

// Glyph paths shared with the live receipts — one visual language for both
// the shell-block and trace-action sources.
const GLYPH: Record<ReceiptRow["receipt"]["glyph"], string> = {
  run: "M5 3.5l7 4.5-7 4.5z", // play triangle — a command / turn
  edit: "M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z", // pencil — a file edit
  guardrail: "M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z", // shield — guarded op
  search: "M10.5 10.5L14 14M7 12A5 5 0 117 2a5 5 0 010 10z", // magnifier — a search
  git: "M5 5.5v5M5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 6c0 3-3 3-6 4.5", // branch
};

/** A formatted clock label for a run header (local time, minute precision). */
function runTime(startedAt: number): string | null {
  if (!startedAt) return null;
  try {
    return new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function RowReceipt({ row }: { row: ReceiptRow }) {
  const r = row.receipt;
  return (
    <Receipt
      icon={GLYPH[r.glyph]}
      label={r.label}
      meta={r.meta ?? (r.running ? "running…" : undefined)}
      tone={r.tone}
    >
      {row.body ? (
        <pre className="wc-mono whitespace-pre-wrap break-words text-meta text-ink-400">{row.body}</pre>
      ) : undefined}
    </Receipt>
  );
}

/** One run = a header (time + outcome dot) over its receipt rows.
 *  Exported (hook-free) so the run rendering is smoke-tested via SSR. */
export function RunGroup({ run }: { run: TranscriptRun }) {
  const time = runTime(run.startedAt);
  const tone = run.outcome === "bad" ? "bad" : run.outcome === "running" ? "ok" : "ok";
  return (
    <section className="flex flex-col gap-0.5">
      {time && (
        <div className="flex items-center gap-2 px-2 pt-2 text-meta text-muted-foreground">
          <StatusDot tone={tone} pulse={run.outcome === "running"} />
          <span className="wc-mono">{time}</span>
        </div>
      )}
      {run.rows.map((row) => (
        <RowReceipt key={row.key} row={row} />
      ))}
    </section>
  );
}

/** The shared scroll shell + run list. Scrollable so history (prior runs) reads
 *  as a conversation log scrolled back through. */
function RunList({ runs, tail }: { runs: TranscriptRun[]; tail?: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-1 px-4 py-4">
        {runs.map((run) => (
          <RunGroup key={run.key} run={run} />
        ))}
        {tail && <div className="mt-2 px-2">{tail}</div>}
      </div>
    </div>
  );
}

/** A calm starter for an empty/new session (no blocks, no trace yet). */
function StarterEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <p className="max-w-xs text-ui leading-relaxed text-muted-foreground">
        This session&apos;s activity will appear here as a timeline of receipts. The live
        terminal is in the <span className="text-muted-foreground">Terminal</span> tab.
      </p>
    </div>
  );
}

/**
 * "Paused — waiting for your input." The calm awaiting-input banner for a shell
 * session that has no running command. A dead session reads as ended.
 */
function PausedBanner({ alive }: { alive: boolean }) {
  if (!alive) {
    return (
      <div className="flex items-center gap-2 text-ui text-muted-foreground">
        <StatusDot tone="idle" /> Session ended.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--border)] bg-popover px-3 py-2 text-ui text-muted-foreground">
      <StatusDot tone="ok" pulse />
      Paused — waiting for your input.
    </div>
  );
}

/** SHELL transcript — grouped live OSC-133 receipts + paused/running tail. */
function ShellTranscript({ sessionId, alive }: { sessionId: string; alive: boolean }) {
  const blocks = useBlocks((s) => s.bySession[sessionId]) ?? [];
  const rows = blockRows(blocks);
  if (rows.length === 0) return <StarterEmpty />;
  const runs = groupRuns(rows);
  const running = rows.some((r) => r.receipt.running);
  const tail = running ? (
    <div className="flex items-center gap-2 text-ui text-muted-foreground">
      <Spinner /> Working…
    </div>
  ) : (
    <PausedBanner alive={alive} />
  );
  return <RunList runs={runs} tail={tail} />;
}

/** AGENT transcript — the captured trace (post-hoc) rendered as receipt rows,
 *  with an explicit "live in the terminal" affordance. Agent sessions emit no
 *  live OSC-133 blocks, so the terminal is the live conversation; this is the
 *  honest structured record of it (never a faked live thread). */
function AgentTranscript({
  sessionId,
  alive,
  onOpenTerminal,
}: {
  sessionId: string;
  alive: boolean;
  onOpenTerminal?: () => void;
}) {
  const queryClient = useQueryClient();
  const traceQ = useSessionTraceQuery(sessionId, true);
  const rows = traceRows(traceQ.data?.actions ?? []);

  const liveAffordance = (
    <div className="flex items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--border)] bg-popover px-3 py-2 text-ui text-muted-foreground">
      <StatusDot tone={alive ? "ok" : "idle"} pulse={alive} />
      {alive ? (
        <>
          <span>The conversation is live in the terminal.</span>
          {onOpenTerminal && (
            <button
              onClick={onOpenTerminal}
              className="ml-auto text-accent-dim underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              Open terminal
            </button>
          )}
        </>
      ) : (
        <span>Session ended.</span>
      )}
    </div>
  );

  if (rows.length === 0) {
    // No captured actions yet — honest: point at the live terminal, not an
    // empty thread. While alive, the trace fills in as it's captured.
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <p className="text-ui leading-relaxed text-muted-foreground">
            {alive
              ? "The agent conversation runs in the terminal. As it's captured, a structured record of each turn and tool call appears here."
              : "No captured actions for this session yet."}
          </p>
          <div className="flex items-center gap-2">
            {alive && onOpenTerminal && (
              <Button variant="primary" onClick={onOpenTerminal}>
                Open terminal
              </Button>
            )}
            {traceQ.isError && (
              <Button onClick={() => void queryClient.invalidateQueries({ queryKey: ["zuzuu", "session-trace", sessionId] })}>
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const runs = groupRuns(rows);
  return <RunList runs={runs} tail={liveAffordance} />;
}

/**
 * The session-as-conversation transcript. Picks its source by session type:
 * shell → live OSC-133 blocks; agent → captured trace actions. The terminal
 * remains the live conversation; this is a derived read-model beside it.
 */
export function Transcript({
  sessionId,
  alive,
  type,
  onOpenTerminal,
}: {
  sessionId: string;
  /** the PTY is still attached — drives paused-vs-running / live affordances */
  alive: boolean;
  /** session type selects the data source (shell → blocks, agent → trace) */
  type: "shell" | "agent";
  /** switch the work pane to the Terminal tab (the live surface) */
  onOpenTerminal?: () => void;
}) {
  return transcriptSourceFor(type) === "trace" ? (
    <AgentTranscript sessionId={sessionId} alive={alive} {...(onOpenTerminal ? { onOpenTerminal } : {})} />
  ) : (
    <ShellTranscript sessionId={sessionId} alive={alive} />
  );
}

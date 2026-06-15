// The SessionTree center view (T2) — a session rendered as a collapsible TREE:
// TURNs as top-level collapsible nodes, TOOL-calls as one-line `Receipt` rows,
// progressive disclosure ("N more"), per-node status tone.
//
//   • PAST session   → static, purely from T1's nested tree (`useSessionTreeQuery`).
//   • LIVE agent      → the same tree, polling T1 as the trace fills in, with a
//                       clear "live in the terminal" affordance (the terminal is
//                       the live surface — never a faked live thread).
//   • Gemini-thin     → turns with no tool children render honestly (no fake).
//   • Empty/new       → a calm starter, not an empty thread.
//
// The terminal itself is untouched: this is a sibling read-model over the
// captured trace. The PTY hot path, reattach/replay and flow control are
// unchanged. The SHELL live path stays in `Transcript.tsx` (OSC-133 blocks).
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Receipt, StatusDot, Button } from "../components/ui";
import { tailState } from "../lib/session-cards";
import { useSessionContentQuery, useSessionTreeQuery } from "../app/queries";
import {
  treeTurns,
  discloseTurns,
  contentTurns,
  discloseContentTurns,
  type TreeTurn,
  type TreeToolRow,
  type ContentTurn,
  type ContentRow,
} from "./session-tree";

// Glyph paths shared with the transcript receipts — one visual language.
const GLYPH: Record<TreeToolRow["receipt"]["glyph"], string> = {
  run: "M5 3.5l7 4.5-7 4.5z", // play triangle — a turn / command
  edit: "M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z", // pencil — a file edit
  guardrail: "M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z", // shield — guarded op
  search: "M10.5 10.5L14 14M7 12A5 5 0 117 2a5 5 0 010 10z", // magnifier — a search
  git: "M5 5.5v5M5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 6c0 3-3 3-6 4.5", // branch
};

/** A formatted clock label for a turn header (local time, minute precision). */
function turnTime(startedAt: number): string | null {
  if (!startedAt) return null;
  try {
    return new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function ToolReceipt({ row }: { row: TreeToolRow }) {
  const r = row.receipt;
  return <Receipt icon={GLYPH[r.glyph]} label={r.label} meta={r.meta ?? undefined} tone={r.tone} />;
}

/** One TURN = a collapsible header (chevron + time + outcome dot + label) over
 *  its tool receipts. Gemini-thin turns (no tools) render with no chevron —
 *  honest, never a faked expandable. Exported (hook state is local) so the turn
 *  rendering is SSR-smoke-tested. */
export function TurnNode({ turn, defaultOpen }: { turn: TreeTurn; defaultOpen?: boolean }) {
  const hasTools = turn.tools.length > 0;
  const [open, setOpen] = useState(defaultOpen ?? false);
  const time = turnTime(turn.startedAt);
  const tone = turn.outcome === "bad" ? "bad" : turn.outcome === "ok" ? "ok" : "idle";

  const header = (
    <>
      {hasTools ? (
        <svg
          viewBox="0 0 16 16"
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="h-3 w-3 shrink-0" />
      )}
      <StatusDot tone={tone} />
      <span className="min-w-0 flex-1 truncate text-ui text-foreground">{turn.label}</span>
      {time && <span className="wc-mono shrink-0 text-meta text-muted-foreground">{time}</span>}
      {hasTools && <span className="wc-mono shrink-0 text-meta text-muted-foreground">{turn.tools.length}</span>}
    </>
  );

  return (
    <section className="flex flex-col">
      {hasTools ? (
        <button
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="wc-focus flex w-full items-center gap-2 rounded-[var(--radius-ui)] px-2 py-1.5 text-left hover:bg-[var(--accent)]"
        >
          {header}
        </button>
      ) : (
        <div className="flex w-full items-center gap-2 px-2 py-1.5">{header}</div>
      )}
      {open && hasTools && (
        <div className="flex flex-col gap-0.5 border-l border-[var(--border)] pl-3 ml-3">
          {turn.tools.map((row) => (
            <ToolReceipt key={row.key} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

/** The turn list with progressive disclosure: older turns collapse behind one
 *  "N more" row; the most recent turn(s) stay open. Exported for SSR smoke. */
export function TurnList({ turns, tail }: { turns: TreeTurn[]; tail?: React.ReactNode }) {
  const { hidden, shown, hiddenCount } = discloseTurns(turns);
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-1 px-4 py-4">
        {hiddenCount > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="wc-focus self-start rounded-[var(--radius-ui)] px-2 py-1 text-meta text-muted-foreground hover:bg-[var(--accent)] hover:text-foreground"
          >
            {hiddenCount} more
          </button>
        )}
        {expanded && hidden.map((turn) => <TurnNode key={turn.key} turn={turn} />)}
        {shown.map((turn, i) => (
          <TurnNode key={turn.key} turn={turn} defaultOpen={i === shown.length - 1} />
        ))}
        {tail && <div className="mt-2 px-2">{tail}</div>}
      </div>
    </div>
  );
}

// ── Content-rich rendering (U2) ────────────────────────────────────────
// When U1 content is present the tree shows the REAL conversation: text rows
// are readable blocks; tool rows are receipts that EXPAND to input + output
// (the Ctrl+O equivalent), with a "show more" hint when the output was capped.

/** A readable text block in the transcript — the agent's reply or a user prompt.
 *  Whitespace is preserved (wrapping) so code/diffs in a reply stay legible. */
function TextBlock({ row }: { row: Extract<ContentRow, { kind: "text" }> }) {
  const isUser = row.role === "user";
  if (!row.text.trim()) return null;
  return (
    <div className="px-2 py-1.5">
      <div className="mb-0.5 text-meta text-muted-foreground">{isUser ? "You" : "Agent"}</div>
      <p
        className={`whitespace-pre-wrap break-words text-ui leading-relaxed ${
          isUser ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {row.text}
      </p>
    </div>
  );
}

/** One tool call: a receipt that expands to its input then output. A truncated
 *  output (capped server-side in U1) shows a "show more" hint — the cap is
 *  applied at the source, so this just signals there was more. */
function ToolContentReceipt({ row }: { row: Extract<ContentRow, { kind: "tool" }> }) {
  const tone = row.receipt.tone === "default" ? "default" : row.receipt.tone;
  const hasDetail = row.toolInput.trim().length > 0 || row.toolOutput.trim().length > 0;
  return (
    <Receipt
      icon={GLYPH[row.receipt.glyph]}
      label={row.receipt.label}
      meta={row.receipt.meta ?? undefined}
      tone={tone}
    >
      {hasDetail ? (
        <div className="flex flex-col gap-2">
          {row.toolInput.trim() && (
            <div>
              <div className="mb-0.5 text-meta text-muted-foreground">Input</div>
              <pre className="wc-mono whitespace-pre-wrap break-words text-meta text-ink-400">{row.toolInput}</pre>
            </div>
          )}
          {row.toolOutput.trim() && (
            <div>
              <div className="mb-0.5 text-meta text-muted-foreground">Output</div>
              <pre className="wc-mono whitespace-pre-wrap break-words text-meta text-ink-400">{row.toolOutput}</pre>
              {row.truncated && (
                <div className="mt-1 text-meta text-muted-foreground">show more — output truncated</div>
              )}
            </div>
          )}
        </div>
      ) : undefined}
    </Receipt>
  );
}

/** One content TURN = a collapsible header over its rich rows (text blocks +
 *  expandable tool receipts). Mirrors `TurnNode` (T1) but content-rich.
 *  Exported (state is local) so the rendering is SSR-smoke-tested. */
export function ContentTurnNode({ turn, defaultOpen }: { turn: ContentTurn; defaultOpen?: boolean }) {
  const hasRows = turn.rows.length > 0;
  const [open, setOpen] = useState(defaultOpen ?? false);
  const time = turnTime(turn.startedAt);
  const tone = turn.outcome === "bad" ? "bad" : turn.outcome === "ok" ? "ok" : "idle";
  const toolCount = turn.rows.filter((r) => r.kind === "tool").length;

  const header = (
    <>
      {hasRows ? (
        <svg
          viewBox="0 0 16 16"
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="h-3 w-3 shrink-0" />
      )}
      <StatusDot tone={tone} />
      <span className="min-w-0 flex-1 truncate text-ui text-foreground">{turn.label}</span>
      {time && <span className="wc-mono shrink-0 text-meta text-muted-foreground">{time}</span>}
      {toolCount > 0 && <span className="wc-mono shrink-0 text-meta text-muted-foreground">{toolCount}</span>}
    </>
  );

  return (
    <section className="flex flex-col">
      {hasRows ? (
        <button
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="wc-focus flex w-full items-center gap-2 rounded-[var(--radius-ui)] px-2 py-1.5 text-left hover:bg-[var(--accent)]"
        >
          {header}
        </button>
      ) : (
        <div className="flex w-full items-center gap-2 px-2 py-1.5">{header}</div>
      )}
      {open && hasRows && (
        <div className="flex flex-col gap-0.5 border-l border-[var(--border)] pl-3 ml-3">
          {turn.rows.map((row) =>
            row.kind === "text" ? (
              <TextBlock key={row.key} row={row} />
            ) : (
              <ToolContentReceipt key={row.key} row={row} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

/** The content turn list with progressive disclosure (older turns collapse
 *  behind one "N more"; the newest turn stays open). Mirrors `TurnList`. */
export function ContentTurnList({ turns, tail }: { turns: ContentTurn[]; tail?: React.ReactNode }) {
  const { hidden, shown, hiddenCount } = discloseContentTurns(turns);
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-1 px-4 py-4">
        {hiddenCount > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="wc-focus self-start rounded-[var(--radius-ui)] px-2 py-1 text-meta text-muted-foreground hover:bg-[var(--accent)] hover:text-foreground"
          >
            {hiddenCount} more
          </button>
        )}
        {expanded && hidden.map((turn) => <ContentTurnNode key={turn.key} turn={turn} />)}
        {shown.map((turn, i) => (
          <ContentTurnNode key={turn.key} turn={turn} defaultOpen={i === shown.length - 1} />
        ))}
        {tail && <div className="mt-2 px-2">{tail}</div>}
      </div>
    </div>
  );
}

/** A calm starter for an empty/new session (null/empty tree). */
function StarterEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <p className="max-w-xs text-ui leading-relaxed text-muted-foreground">
        This session&apos;s turns and tool calls will appear here as a tree. The live conversation
        is in the <span className="text-muted-foreground">Terminal</span> tab.
      </p>
    </div>
  );
}

/**
 * Render a session as a tree from T1's nested trace. `alive` drives the
 * live-vs-static affordance; a live session polls T1 (the tree fills in as it's
 * captured) while the terminal stays the live surface. A past session is static
 * (the cached tree never changes). Both render the identical tree.
 */
export function SessionTree({
  sessionId,
  alive,
  enabled = true,
  onOpenTerminal,
  sessionState,
}: {
  sessionId: string;
  /** the PTY is still attached — drives the live affordance */
  alive: boolean;
  /** poll T1 (a live session); a past session can pass false to read once */
  enabled?: boolean;
  /** switch the work pane to the Terminal tab (the live surface) */
  onOpenTerminal?: () => void;
  /** the captured trace lifecycle state — distinguishes "live outside the
   *  workbench" (active/opening) from a truly ended session */
  sessionState?: string;
}) {
  const queryClient = useQueryClient();
  const treeQ = useSessionTreeQuery(sessionId, enabled);
  // U1 content (the REAL host-transcript: agent/user text + tool I/O), read on
  // demand. A live session streams it in (polled); a past session reads once.
  // Fail-soft on the daemon (missing/thin transcript → nodes []), so we degrade
  // to the counts/kinds T1 tree below when there's no content.
  const contentQ = useSessionContentQuery(sessionId, enabled);
  const richTurns = contentTurns(contentQ.data?.nodes ?? null);
  const turns = treeTurns(treeQ.data?.root ?? null);

  const tail = tailState(alive, sessionState);
  const liveAffordance = (
    <div className="flex items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--border)] bg-popover px-3 py-2 text-ui text-muted-foreground">
      <StatusDot tone={tail === "live" ? "ok" : "idle"} pulse={tail === "live"} />
      {tail === "live" ? (
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
      ) : tail === "outside" ? (
        <span>Live in your terminal — the workbench is mirroring it (view-only here).</span>
      ) : (
        <span>Session ended.</span>
      )}
    </div>
  );

  // Content-rich is the preferred surface: when U1 resolved real transcript
  // content, render the conversation (text + expandable tool I/O). When there's
  // no content (transcript missing/gone, or a thin host with nothing yet),
  // degrade to the counts/kinds T1 tree — fail-soft, never empty if either has
  // signal.
  if (richTurns.length > 0) {
    return <ContentTurnList turns={richTurns} tail={liveAffordance} />;
  }

  if (turns.length === 0) {
    if (alive) {
      // No captured turns yet — honest: point at the live terminal, not an
      // empty thread. The tree fills in as the trace is captured.
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="flex max-w-sm flex-col items-center gap-3">
            <p className="text-ui leading-relaxed text-muted-foreground">
              The conversation runs in the terminal. As it&apos;s captured, each turn and tool call
              appears here as a tree.
            </p>
            <div className="flex items-center gap-2">
              {onOpenTerminal && (
                <Button variant="primary" onClick={onOpenTerminal}>
                  Open terminal
                </Button>
              )}
              {treeQ.isError && (
                <Button
                  onClick={() =>
                    void queryClient.invalidateQueries({ queryKey: ["zuzuu", "session-tree", sessionId] })
                  }
                >
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return <StarterEmpty />;
  }

  return <TurnList turns={turns} tail={liveAffordance} />;
}

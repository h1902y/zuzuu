// Pure, testable read-model for the terminal-native transcript (U7).
//
// The transcript is 100% DERIVED — never a chat/message protocol:
//   • SHELL sessions emit OSC-133 command blocks (live, client-side, `useBlocks`).
//     We group consecutive blocks into RUNS (by an idle gap between commands) so
//     the log reads as discrete bursts of work with timestamps + a run outcome,
//     and history = scrolling back through prior runs.
//   • AGENT sessions emit NO OSC-133 blocks (rc injection is disabled for agent
//     commands). Their transcript is rendered post-hoc from U6's captured trace
//     actions (SessionTraceAction[]) — and the live conversation stays in the
//     terminal, never a faked live thread.
//
// This module is React/DOM-free so the grouping + mapping are unit-tested
// without a browser. `blockReceipt`/`receiptForCommand` already turn one block
// into a one-line receipt shape; here we add the run-level grouping and the
// trace-action → receipt-row mapping, plus the source-selection rule.
import type { SessionTraceAction } from "@zuzuu-web/protocol";
import { blockReceipt, type CommandReceipt, type ReceiptTone } from "../lib/session-cards";
import type { Block } from "./blocks";

/** Default idle gap (ms) that starts a new run. A burst of commands fired
 *  close together is one run; a fresh command after a pause begins the next. */
export const RUN_GAP_MS = 60_000;

/** A receipt-shaped row, source-agnostic: shell blocks and agent trace actions
 *  both normalize to this so one `<Receipt>` renders both. */
export interface ReceiptRow {
  /** stable key within a session */
  key: string;
  receipt: CommandReceipt;
  /** the expandable body (the raw command for shell; absent for trace rows) */
  body?: string;
  /** wall-clock label for the row, when known (mono meta is the receipt's own) */
  ts?: number;
}

/** A run = a contiguous burst of receipt rows with a start time + outcome.
 *  Outcome is "bad" if any row failed, "running" if any is still going, else
 *  "ok". Grouping gives the transcript its conversation rhythm + history. */
export interface TranscriptRun {
  /** stable key for the run (the first row's key) */
  key: string;
  /** epoch ms of the run's first row (0 when unknown) */
  startedAt: number;
  rows: ReceiptRow[];
  outcome: "ok" | "bad" | "running";
}

/** Which data source feeds the transcript for a given session type. */
export type TranscriptSource = "blocks" | "trace";
export function transcriptSourceFor(type: "shell" | "agent"): TranscriptSource {
  // shell → live OSC-133 blocks; agent → post-hoc captured trace.
  return type === "agent" ? "trace" : "blocks";
}

/** Map one OSC-133 command block to a receipt row (shell sessions). */
export function blockRow(block: Block): ReceiptRow {
  const multiline = block.command.includes("\n");
  return {
    key: `b${block.id}`,
    receipt: blockReceipt(block),
    body: multiline ? block.command : `$ ${block.command}`,
    ts: block.startedAt,
  };
}

/** The verb-class → receipt glyph map for trace actions, mirroring the
 *  command receipt glyphs so the two sources read consistently. */
function traceGlyph(action: SessionTraceAction): CommandReceipt["glyph"] {
  if (action.kind === "turn") return "run";
  const label = action.label.toLowerCase();
  if (/\b(edit|write|create|patch)\b/.test(label)) return "edit";
  if (/\b(grep|search|glob|find|read)\b/.test(label)) return "search";
  if (/\b(git|branch|commit)\b/.test(label)) return "git";
  if (/\b(bash|rm|sudo|kill)\b/.test(label)) return "guardrail";
  return "run";
}

/** Map one captured trace action to a receipt row (agent sessions). Trace rows
 *  are historical, so they are never "running"; status drives the tone. */
export function traceActionRow(action: SessionTraceAction, idx: number): ReceiptRow {
  const tone: ReceiptTone =
    action.status === "error" ? "bad" : action.status === "ok" ? "ok" : "default";
  const ts = Date.parse(action.ts);
  const receipt: CommandReceipt = {
    label: action.label,
    meta: action.kind === "tool" ? "tool" : action.kind === "turn" ? "turn" : null,
    tone,
    glyph: traceGlyph(action),
    running: false,
  };
  return {
    key: `t${idx}`,
    receipt,
    ts: Number.isFinite(ts) ? ts : 0,
  };
}

/** Map U6 trace actions → receipt rows (agent / history source). */
export function traceRows(actions: SessionTraceAction[]): ReceiptRow[] {
  return actions.map(traceActionRow);
}

/** Map live OSC-133 blocks → receipt rows (only blocks with a command). */
export function blockRows(blocks: Block[]): ReceiptRow[] {
  return blocks.filter((b) => b.command.trim().length > 0).map(blockRow);
}

/** Reduce a flat list of receipt rows into runs, split on an idle gap. Rows
 *  without a usable ts join the current run (they never start a new one), so a
 *  trace with sparse timestamps still groups coherently. History = the run
 *  list, oldest→newest, scrolled in the view. */
export function groupRuns(rows: ReceiptRow[], gapMs: number = RUN_GAP_MS): TranscriptRun[] {
  const runs: TranscriptRun[] = [];
  let lastTs: number | null = null;
  for (const row of rows) {
    const ts = row.ts && row.ts > 0 ? row.ts : null;
    const startNew =
      runs.length === 0 || (ts !== null && lastTs !== null && ts - lastTs > gapMs);
    if (startNew) {
      runs.push({ key: row.key, startedAt: ts ?? 0, rows: [row], outcome: "running" });
    } else {
      runs[runs.length - 1]!.rows.push(row);
    }
    if (ts !== null) lastTs = ts;
  }
  for (const run of runs) run.outcome = runOutcome(run.rows);
  return runs;
}

/** A run's outcome: any failure → bad, else any still-running → running, else ok. */
export function runOutcome(rows: ReceiptRow[]): TranscriptRun["outcome"] {
  if (rows.some((r) => r.receipt.tone === "bad")) return "bad";
  if (rows.some((r) => r.receipt.running)) return "running";
  return "ok";
}

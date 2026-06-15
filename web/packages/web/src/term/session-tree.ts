// Pure, DOM-free read-model for the SessionTree view (T2).
//
// A session IS a tree — zuzuu captures every host session host-agnostically as
// SESSION → TURN → TOOL_CALL (T1's nested `SessionTreeNode`). This module turns
// that nested tree into a flat, render-ready list of TURN groups, each carrying
// its TOOL children as one-line receipt rows:
//
//   • TURN  → a top-level collapsible node (a user-prompt → response cycle).
//   • TOOL  → a one-line `Receipt` child (status → tone, label → glyph).
//   • Gemini degrades honestly: turns with NO tool children render as turns with
//     no expandable children — never faked.
//   • Progressive disclosure: the most recent turn is open, older turns collapse
//     behind a single "N more" affordance so a long session stays scannable.
//
// React/DOM-free so the grouping + mapping are unit-tested without a browser.
// The component (`SessionTree.tsx`) is a thin renderer over `treeTurns`.
import type { SessionTreeNode } from "@zuzuu-web/protocol";
import type { CommandReceipt, ReceiptTone } from "../lib/session-cards";

/** A tool-call rendered as a one-line receipt row inside its turn. */
export interface TreeToolRow {
  /** stable key within the turn */
  key: string;
  receipt: CommandReceipt;
  ts: number;
}

/** A TURN node = a collapsible header (time + outcome) over its tool receipts. */
export interface TreeTurn {
  /** stable key for the turn */
  key: string;
  /** the turn's own label (the prompt/summary line) */
  label: string;
  /** epoch ms of the turn (0 when unknown) */
  startedAt: number;
  /** the turn's status tone (rolls up its tools; bad if any tool failed) */
  outcome: "ok" | "bad" | "neutral";
  /** the tool-call children (empty for Gemini-thin / turns with no tools) */
  tools: TreeToolRow[];
}

/** The verb-class → receipt glyph map for tree nodes, mirroring the transcript
 *  glyphs so tree + transcript read with one visual language. */
export function nodeGlyph(node: SessionTreeNode): CommandReceipt["glyph"] {
  if (node.kind === "turn") return "run";
  const label = node.label.toLowerCase();
  if (/\b(edit|write|create|patch)\b/.test(label)) return "edit";
  if (/\b(grep|search|glob|find|read)\b/.test(label)) return "search";
  if (/\b(git|branch|commit)\b/.test(label)) return "git";
  if (/\b(bash|rm|sudo|kill)\b/.test(label)) return "guardrail";
  return "run";
}

/** status → receipt tone (ok / error → ok / bad; absent → default). */
export function toneFor(status: SessionTreeNode["status"]): ReceiptTone {
  return status === "error" ? "bad" : status === "ok" ? "ok" : "default";
}

const epoch = (ts: string): number => {
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : 0;
};

/** Map one TOOL (or other) child node → a one-line receipt row. Tree rows are
 *  historical, so they are never "running"; status drives the tone. */
export function toolRow(node: SessionTreeNode, key: string): TreeToolRow {
  return {
    key,
    receipt: {
      label: node.label,
      meta: node.kind === "tool" ? "tool" : null,
      tone: toneFor(node.status),
      glyph: nodeGlyph(node),
      running: false,
    },
    ts: epoch(node.ts),
  };
}

/** A turn's outcome rolls up its tools: any tool error → bad, else if the turn
 *  itself errored → bad, else "ok" when there's signal, else "neutral". */
export function turnOutcome(turn: SessionTreeNode, tools: TreeToolRow[]): TreeTurn["outcome"] {
  if (turn.status === "error" || tools.some((t) => t.receipt.tone === "bad")) return "bad";
  if (turn.status === "ok" || tools.some((t) => t.receipt.tone === "ok")) return "ok";
  return "neutral";
}

/**
 * Flatten a captured session tree into its ordered TURN groups. The root is the
 * SESSION span; its children are turns; each turn's children are tool calls.
 *
 * Honest cross-host shape: a Gemini-thin tree (turns with no tool children)
 * yields turns whose `tools` is [] — the renderer shows them with no expandable
 * children, never faked. A null/empty root yields [] (the calm starter case).
 *
 * Defensive: a SESSION root whose direct children are already tools (no turn
 * layer) still renders — the tools attach to a single synthetic turn so nothing
 * is dropped.
 */
export function treeTurns(root: SessionTreeNode | null): TreeTurn[] {
  if (!root) return [];
  const children = root.children ?? [];
  if (children.length === 0) return [];

  // Turn-layered (the normal case): each child is a turn carrying tools.
  const turns = children.filter((c) => c.kind === "turn");
  const looseTools = children.filter((c) => c.kind !== "turn");

  const result: TreeTurn[] = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]!;
    const tools = (turn.children ?? []).map((c, j) => toolRow(c, `${i}-${j}`));
    result.push({
      key: `turn-${i}`,
      label: turn.label,
      startedAt: epoch(turn.ts),
      outcome: turnOutcome(turn, tools),
      tools,
    });
  }

  // Degenerate: SESSION → tool,tool with no turn layer. Don't drop them.
  if (turns.length === 0 && looseTools.length > 0) {
    const tools = looseTools.map((c, j) => toolRow(c, `loose-${j}`));
    result.push({
      key: "turn-0",
      label: root.label || "Session",
      startedAt: epoch(root.ts),
      outcome: turnOutcome(root, tools),
      tools,
    });
  }

  return result;
}

/** A turn group split for progressive disclosure: the newest turns are shown
 *  open; older turns collapse behind a single "N more" affordance. `hiddenCount`
 *  is how many turns the "N more" row stands for (0 → no affordance). */
export interface TurnDisclosure {
  /** the older turns hidden behind "N more" (shown when expanded) */
  hidden: TreeTurn[];
  /** the recent turns always shown */
  shown: TreeTurn[];
  /** count behind the "N more" row (== hidden.length) */
  hiddenCount: number;
}

/** Default number of most-recent turns kept open; older ones collapse. */
export const RECENT_TURNS = 1;

/**
 * Split turns into {hidden older, shown recent} for progressive disclosure.
 * Keeps the last `recent` turns visible; everything before collapses to "N more".
 * With <= `recent` turns nothing is hidden.
 */
export function discloseTurns(turns: TreeTurn[], recent: number = RECENT_TURNS): TurnDisclosure {
  if (turns.length <= recent) return { hidden: [], shown: turns, hiddenCount: 0 };
  const cut = turns.length - recent;
  const hidden = turns.slice(0, cut);
  return { hidden, shown: turns.slice(cut), hiddenCount: hidden.length };
}

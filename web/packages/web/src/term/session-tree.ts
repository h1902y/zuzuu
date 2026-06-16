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
import type { SessionContentNode, SessionTreeNode } from "@zuzuu-web/protocol";
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

// ── Content-rich model (U2) ────────────────────────────────────────────
//
// U1 (`GET /session-content/:id`) gives the REAL host-transcript content as an
// ORDERED list of `SessionContentNode` (kind ∈ agent_text | user_text | tool,
// carrying text / toolInput / toolOutput / status / truncated). This block
// turns that flat ordered list into the same TURN grouping the tree uses, but
// with each turn carrying RICH rows — text blocks (the conversation) and tool
// rows that expand to input + output (the Ctrl+O equivalent).
//
// Grouping rule (honest, source-ordered): a user prompt opens a turn; every
// agent_text/tool node that follows belongs to that turn until the next user
// prompt. Content that precedes any user prompt (or a host with no user nodes,
// e.g. Gemini text-only) falls into a leading turn so nothing is dropped.
// DOM-free so the grouping is unit-tested without a browser.

/** One RICH row inside a content turn: a readable text block, or a tool call
 *  that expands to its input + output. A discriminated union keyed by `kind`. */
export type ContentRow =
  | {
      kind: "text";
      key: string;
      /** "agent" → the agent's reply; "user" → a user prompt */
      role: "agent" | "user";
      text: string;
      ts: number;
    }
  | {
      kind: "tool";
      key: string;
      /** the one-line receipt header (status → tone, label class → glyph) */
      receipt: CommandReceipt;
      toolInput: string;
      toolOutput: string;
      /** the size cap (U1, server-side) cut the output → show a "show more" hint */
      truncated: boolean;
      ts: number;
    };

/** A content turn = a label + outcome over its ordered RICH rows. Mirrors
 *  `TreeTurn` so the renderer's disclosure/grouping is shared. */
export interface ContentTurn {
  key: string;
  label: string;
  startedAt: number;
  outcome: "ok" | "bad" | "neutral";
  rows: ContentRow[];
}

/** display status ("ok" | "error" | undefined) → receipt tone. */
function contentTone(status: SessionContentNode["status"]): ReceiptTone {
  return status === "error" ? "bad" : status === "ok" ? "ok" : "default";
}

/** Pick a tree glyph for a tool content node from its label (same map as the
 *  T1 tree so content + counts read with one visual language). */
function contentGlyph(label: string): CommandReceipt["glyph"] {
  const l = label.toLowerCase();
  if (/\b(edit|write|create|patch)\b/.test(l)) return "edit";
  if (/\b(grep|search|glob|find|read)\b/.test(l)) return "search";
  if (/\b(git|branch|commit)\b/.test(l)) return "git";
  if (/\b(bash|rm|sudo|kill)\b/.test(l)) return "guardrail";
  return "run";
}

/** Map one tool content node → an expandable tool row. */
function toolContentRow(n: SessionContentNode, key: string): ContentRow {
  return {
    kind: "tool",
    key,
    receipt: {
      label: n.label,
      meta: "tool",
      tone: contentTone(n.status),
      glyph: contentGlyph(n.label),
      running: false,
    },
    toolInput: n.toolInput ?? "",
    toolOutput: n.toolOutput ?? "",
    truncated: n.truncated ?? false,
    ts: epoch(n.ts),
  };
}

/** A content turn's outcome rolls up its tool rows: any tool error → bad, any
 *  tool ok → ok, else neutral (a text-only / Gemini-thin turn). */
export function contentOutcome(rows: ContentRow[]): ContentTurn["outcome"] {
  const tools = rows.filter((r): r is Extract<ContentRow, { kind: "tool" }> => r.kind === "tool");
  if (tools.some((t) => t.receipt.tone === "bad")) return "bad";
  if (tools.some((t) => t.receipt.tone === "ok")) return "ok";
  return "neutral";
}

/** A short, single-line turn label from a user prompt (first non-empty line,
 *  clipped) — falls back to a generic label for a leading/text-only turn. */
function turnLabelFrom(text: string, fallback: string): string {
  const line = text.split("\n").map((s) => s.trim()).find((s) => s.length > 0);
  if (!line) return fallback;
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}

/**
 * Group the ordered U1 content nodes into content-rich TURNs. A `user_text`
 * node opens a new turn (its text becomes the turn label AND its first row);
 * agent_text + tool nodes attach to the open turn. Nodes before the first user
 * prompt — or a host with no user nodes at all (Gemini text-only) — collect into
 * a single leading turn so nothing is dropped. Empty input → [] (calm starter).
 */
export function contentTurns(nodes: SessionContentNode[] | null | undefined): ContentTurn[] {
  if (!nodes || nodes.length === 0) return [];
  const turns: ContentTurn[] = [];
  let current: ContentTurn | null = null;
  let ti = 0;

  const openTurn = (label: string, startedAt: number) => {
    current = { key: `cturn-${ti}`, label, startedAt, outcome: "neutral", rows: [] };
    turns.push(current);
    ti++;
  };

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const ts = epoch(n.ts);
    if (n.kind === "user_text") {
      const text = n.text ?? "";
      openTurn(turnLabelFrom(text, n.label || "Prompt"), ts);
      current!.rows.push({ kind: "text", key: `${current!.key}-r${current!.rows.length}`, role: "user", text, ts });
      continue;
    }
    if (!current) openTurn(n.label || "Session", ts);
    if (n.kind === "agent_text") {
      current!.rows.push({
        kind: "text",
        key: `${current!.key}-r${current!.rows.length}`,
        role: "agent",
        text: n.text ?? "",
        ts,
      });
    } else {
      current!.rows.push(toolContentRow(n, `${current!.key}-r${current!.rows.length}`));
    }
  }

  for (const t of turns) t.outcome = contentOutcome(t.rows);
  return turns;
}

/** Disclosure split for content turns (same shape/contract as `discloseTurns`):
 *  keep the last `recent` turns shown, collapse older behind one "N more". */
export interface ContentDisclosure {
  hidden: ContentTurn[];
  shown: ContentTurn[];
  hiddenCount: number;
}

export function discloseContentTurns(
  turns: ContentTurn[],
  recent: number = RECENT_TURNS,
): ContentDisclosure {
  if (turns.length <= recent) return { hidden: [], shown: turns, hiddenCount: 0 };
  const cut = turns.length - recent;
  const hidden = turns.slice(0, cut);
  return { hidden, shown: turns.slice(cut), hiddenCount: hidden.length };
}

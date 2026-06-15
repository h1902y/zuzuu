// T2 — the SessionTree read-model. The vitest env is node (no DOM), so we cover
// the PURE tree→turns/grouping logic (turn grouping, "N more" disclosure,
// tool→receipt mapping, ok/error tone, empty tree, gemini-thin no-children)
// plus a renderToStaticMarkup smoke of the turn rendering. The terminal stays
// the live conversation — these never touch the PTY path.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionContentNode, SessionTreeNode } from "@zuzuu-web/protocol";
import { TurnNode, TurnList, ContentTurnNode, ContentTurnList } from "./SessionTree";
import {
  treeTurns,
  discloseTurns,
  toolRow,
  nodeGlyph,
  toneFor,
  turnOutcome,
  contentTurns,
  contentOutcome,
  discloseContentTurns,
  RECENT_TURNS,
  type TreeTurn,
} from "./session-tree";

// A node factory (only the fields the model reads).
function node(p: Partial<SessionTreeNode> & { kind: SessionTreeNode["kind"]; label: string }): SessionTreeNode {
  return {
    kind: p.kind,
    label: p.label,
    ts: p.ts ?? "2026-06-15T10:00:00.000Z",
    ...(p.status ? { status: p.status } : {}),
    children: p.children ?? [],
  };
}

describe("treeTurns (session → turns → tools)", () => {
  it("renders turns as nodes with their tools as receipt children, time-ordered", () => {
    const root = node({
      kind: "session",
      label: "Session",
      children: [
        node({
          kind: "turn",
          label: "Add a test",
          ts: "2026-06-15T10:00:00.000Z",
          children: [
            node({ kind: "tool", label: "Bash: npm test", ts: "2026-06-15T10:00:05.000Z", status: "ok" }),
            node({ kind: "tool", label: "Edit transcript.ts", ts: "2026-06-15T10:00:30.000Z", status: "error" }),
          ],
        }),
      ],
    });
    const turns = treeTurns(root);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.label).toBe("Add a test");
    expect(turns[0]!.tools.map((t) => t.receipt.label)).toEqual(["Bash: npm test", "Edit transcript.ts"]);
    expect(turns[0]!.startedAt).toBe(Date.parse("2026-06-15T10:00:00.000Z"));
  });

  it("multiple turns preserve order", () => {
    const root = node({
      kind: "session",
      label: "S",
      children: [
        node({ kind: "turn", label: "first", ts: "2026-06-15T10:00:00.000Z" }),
        node({ kind: "turn", label: "second", ts: "2026-06-15T10:05:00.000Z" }),
      ],
    });
    expect(treeTurns(root).map((t) => t.label)).toEqual(["first", "second"]);
  });

  it("a degenerate session → tool,tool (no turn layer) attaches tools to one turn", () => {
    const root = node({
      kind: "session",
      label: "Session",
      children: [
        node({ kind: "tool", label: "Bash: ls", status: "ok" }),
        node({ kind: "tool", label: "Read foo.ts", status: "ok" }),
      ],
    });
    const turns = treeTurns(root);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.tools).toHaveLength(2);
  });
});

describe("tool → receipt mapping (tone + glyph)", () => {
  it("status ok/error maps to ok/bad tone", () => {
    expect(toneFor("ok")).toBe("ok");
    expect(toneFor("error")).toBe("bad");
    expect(toneFor(undefined)).toBe("default");
  });

  it("tool rows are never running (historical)", () => {
    const r = toolRow(node({ kind: "tool", label: "Bash: ls", status: "ok" }), "0-0");
    expect(r.receipt.running).toBe(false);
    expect(r.receipt.tone).toBe("ok");
  });

  it("glyph reflects the node label class (edit/search/git/bash)", () => {
    expect(nodeGlyph(node({ kind: "tool", label: "Edit foo.ts" }))).toBe("edit");
    expect(nodeGlyph(node({ kind: "tool", label: "Grep for TODO" }))).toBe("search");
    expect(nodeGlyph(node({ kind: "tool", label: "git commit" }))).toBe("git");
    expect(nodeGlyph(node({ kind: "tool", label: "Bash: rm -rf" }))).toBe("guardrail");
    expect(nodeGlyph(node({ kind: "turn", label: "anything" }))).toBe("run");
  });

  it("turn outcome rolls up tool failures → bad", () => {
    const turn = node({ kind: "turn", label: "t" });
    const okTools = [toolRow(node({ kind: "tool", label: "a", status: "ok" }), "0")];
    const badTools = [toolRow(node({ kind: "tool", label: "a", status: "error" }), "0")];
    expect(turnOutcome(turn, okTools)).toBe("ok");
    expect(turnOutcome(turn, badTools)).toBe("bad");
    expect(turnOutcome(turn, [])).toBe("neutral");
  });
});

describe("gemini-thin (turns, empty children)", () => {
  it("renders turns with no tool children — never faked", () => {
    const root = node({
      kind: "session",
      label: "Gemini session",
      children: [
        node({ kind: "turn", label: "asked a question" }),
        node({ kind: "turn", label: "asked another" }),
      ],
    });
    const turns = treeTurns(root);
    expect(turns).toHaveLength(2);
    expect(turns.every((t) => t.tools.length === 0)).toBe(true);
  });
});

describe("empty / null tree → calm starter (no turns)", () => {
  it("null root → no turns", () => {
    expect(treeTurns(null)).toEqual([]);
  });
  it("session with no children → no turns", () => {
    expect(treeTurns(node({ kind: "session", label: "S", children: [] }))).toEqual([]);
  });
});

describe("progressive disclosure (older turns collapse to 'N more')", () => {
  const turns: TreeTurn[] = Array.from({ length: 4 }, (_, i) => ({
    key: `turn-${i}`,
    label: `turn ${i}`,
    startedAt: i,
    outcome: "ok" as const,
    tools: [],
  }));

  it("keeps the most recent turn(s) shown, hides older behind 'N more'", () => {
    const d = discloseTurns(turns);
    expect(d.shown).toHaveLength(RECENT_TURNS);
    expect(d.shown[d.shown.length - 1]!.label).toBe("turn 3"); // newest shown
    expect(d.hiddenCount).toBe(4 - RECENT_TURNS);
    expect(d.hidden).toHaveLength(4 - RECENT_TURNS);
  });

  it("with <= recent turns nothing is hidden", () => {
    const d = discloseTurns(turns.slice(0, RECENT_TURNS));
    expect(d.hiddenCount).toBe(0);
    expect(d.hidden).toEqual([]);
  });
});

// ── Content-rich model (U2) ────────────────────────────────────────────
function cnode(p: Partial<SessionContentNode> & { kind: SessionContentNode["kind"] }): SessionContentNode {
  return {
    kind: p.kind,
    label: p.label ?? "",
    ts: p.ts ?? "2026-06-15T10:00:00.000Z",
    ...(p.text !== undefined ? { text: p.text } : {}),
    ...(p.toolInput !== undefined ? { toolInput: p.toolInput } : {}),
    ...(p.toolOutput !== undefined ? { toolOutput: p.toolOutput } : {}),
    ...(p.status ? { status: p.status } : {}),
    ...(p.truncated ? { truncated: p.truncated } : {}),
  };
}

// A generic redaction marker the way U1 would emit it (no real secret literal).
const REDACTED = "TOKEN=[redacted]";

describe("contentTurns (ordered content nodes → content-rich turns)", () => {
  it("a user prompt opens a turn; agent text + tools attach to it", () => {
    const turns = contentTurns([
      cnode({ kind: "user_text", text: "Add a test for the parser" }),
      cnode({ kind: "agent_text", text: "Sure — I'll add one now." }),
      cnode({ kind: "tool", label: "Bash: npm test", toolInput: "npm test", toolOutput: "ok", status: "ok" }),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.label).toBe("Add a test for the parser");
    expect(turns[0]!.rows.map((r) => r.kind)).toEqual(["text", "text", "tool"]);
  });

  it("a new user prompt starts a new turn", () => {
    const turns = contentTurns([
      cnode({ kind: "user_text", text: "first" }),
      cnode({ kind: "agent_text", text: "ok 1" }),
      cnode({ kind: "user_text", text: "second" }),
      cnode({ kind: "agent_text", text: "ok 2" }),
    ]);
    expect(turns.map((t) => t.label)).toEqual(["first", "second"]);
  });

  it("content before any user prompt falls into a leading turn (nothing dropped)", () => {
    const turns = contentTurns([
      cnode({ kind: "agent_text", label: "Session", text: "starting up" }),
      cnode({ kind: "tool", label: "Read foo.ts", status: "ok" }),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.rows).toHaveLength(2);
  });

  it("empty / null content → no turns (calm starter)", () => {
    expect(contentTurns([])).toEqual([]);
    expect(contentTurns(null)).toEqual([]);
    expect(contentTurns(undefined)).toEqual([]);
  });

  it("an agent_text node carries the reply text into a text row", () => {
    const [turn] = contentTurns([cnode({ kind: "agent_text", text: "Here is the answer." })]);
    const row = turn!.rows[0]!;
    expect(row.kind).toBe("text");
    if (row.kind === "text") {
      expect(row.role).toBe("agent");
      expect(row.text).toBe("Here is the answer.");
    }
  });

  it("a tool node carries input + output + truncation onto a tool row", () => {
    const [turn] = contentTurns([
      cnode({
        kind: "tool",
        label: "Bash: cat big.log",
        toolInput: "cat big.log",
        toolOutput: "line1\nline2",
        status: "ok",
        truncated: true,
      }),
    ]);
    const row = turn!.rows[0]!;
    expect(row.kind).toBe("tool");
    if (row.kind === "tool") {
      expect(row.toolInput).toBe("cat big.log");
      expect(row.toolOutput).toBe("line1\nline2");
      expect(row.truncated).toBe(true);
      expect(row.receipt.tone).toBe("ok");
    }
  });

  it("a redacted value displays as-is (no special handling)", () => {
    const [turn] = contentTurns([cnode({ kind: "tool", label: "Read config", toolOutput: REDACTED, status: "ok" })]);
    const row = turn!.rows[0]!;
    expect(row.kind === "tool" && row.toolOutput).toBe(REDACTED);
  });

  it("outcome rolls up: any tool error → bad, any tool ok → ok, text-only → neutral", () => {
    expect(
      contentTurns([
        cnode({ kind: "tool", label: "a", status: "ok" }),
        cnode({ kind: "tool", label: "b", status: "error" }),
      ])[0]!.outcome,
    ).toBe("bad");
    expect(contentTurns([cnode({ kind: "tool", label: "a", status: "ok" })])[0]!.outcome).toBe("ok");
    expect(contentTurns([cnode({ kind: "agent_text", text: "hi" })])[0]!.outcome).toBe("neutral");
  });

  it("contentOutcome is pure over rows", () => {
    const [turn] = contentTurns([cnode({ kind: "tool", label: "x", status: "error" })]);
    expect(contentOutcome(turn!.rows)).toBe("bad");
  });
});

describe("gemini-thin content (text-only, no tools)", () => {
  it("renders text turns with no tool rows", () => {
    const turns = contentTurns([
      cnode({ kind: "user_text", text: "what is two plus two" }),
      cnode({ kind: "agent_text", text: "4" }),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.rows.every((r) => r.kind === "text")).toBe(true);
  });
});

describe("content disclosure (older turns collapse to 'N more')", () => {
  it("keeps the most recent turn shown, hides older", () => {
    const turns = contentTurns(
      Array.from({ length: 4 }, (_, i) => cnode({ kind: "user_text", text: `prompt ${i}` })),
    );
    const d = discloseContentTurns(turns);
    expect(d.shown).toHaveLength(RECENT_TURNS);
    expect(d.hiddenCount).toBe(4 - RECENT_TURNS);
  });
});

describe("content render smoke (node SSR, no DOM)", () => {
  it("a tool content row renders as an expandable receipt (its label shown)", () => {
    const [turn] = contentTurns([
      cnode({
        kind: "tool",
        label: "Bash: npm test",
        toolInput: "npm test",
        toolOutput: "PASS 12 tests",
        status: "ok",
      }),
    ]);
    const html = renderToStaticMarkup(<ContentTurnNode turn={turn!} defaultOpen />);
    expect(html).toContain("Bash: npm test");
    expect(html).toContain('aria-expanded="true"'); // the turn header is open
  });

  it("an agent_text row renders its reply text in the transcript", () => {
    const [turn] = contentTurns([cnode({ kind: "agent_text", text: "Here is the plan." })]);
    const html = renderToStaticMarkup(<ContentTurnNode turn={turn!} defaultOpen />);
    expect(html).toContain("Here is the plan.");
    expect(html).toContain("Agent");
  });

  it("a user_text row renders the prompt", () => {
    const [turn] = contentTurns([cnode({ kind: "user_text", text: "do the thing" })]);
    const html = renderToStaticMarkup(<ContentTurnNode turn={turn!} defaultOpen />);
    expect(html).toContain("do the thing");
    expect(html).toContain("You");
  });

  it("a redacted value renders as-is", () => {
    const [turn] = contentTurns([cnode({ kind: "agent_text", text: `the key is ${REDACTED}` })]);
    const html = renderToStaticMarkup(<ContentTurnNode turn={turn!} defaultOpen />);
    expect(html).toContain("[redacted]");
  });

  it("a content turn list renders its turns", () => {
    const turns = contentTurns([
      cnode({ kind: "user_text", text: "hi" }),
      cnode({ kind: "tool", label: "cat big", toolOutput: "first chunk", status: "ok", truncated: true }),
    ]);
    const html = renderToStaticMarkup(<ContentTurnList turns={turns} />);
    expect(html).toContain("hi");
    expect(html).toContain("cat big");
  });
});

describe("render smoke (node SSR, no DOM)", () => {
  it("a turn with tools renders a collapsible header with its tool count", () => {
    const [turn] = treeTurns(
      node({
        kind: "session",
        label: "S",
        children: [
          node({
            kind: "turn",
            label: "Add a test",
            children: [node({ kind: "tool", label: "Bash: npm test", status: "ok" })],
          }),
        ],
      }),
    );
    const html = renderToStaticMarkup(<TurnNode turn={turn!} defaultOpen />);
    expect(html).toContain("Add a test");
    expect(html).toContain("Bash: npm test"); // open → tool visible
    expect(html).toContain('aria-expanded="true"');
  });

  it("a gemini-thin turn renders no chevron button (no fake expandable)", () => {
    const [turn] = treeTurns(
      node({ kind: "session", label: "S", children: [node({ kind: "turn", label: "asked" })] }),
    );
    const html = renderToStaticMarkup(<TurnNode turn={turn!} />);
    expect(html).toContain("asked");
    expect(html).not.toContain("aria-expanded");
  });

  it("the turn list shows a 'N more' affordance for older turns", () => {
    const turns: TreeTurn[] = Array.from({ length: 3 }, (_, i) => ({
      key: `turn-${i}`,
      label: `turn ${i}`,
      startedAt: i,
      outcome: "ok" as const,
      tools: [],
    }));
    const html = renderToStaticMarkup(<TurnList turns={turns} />);
    expect(html).toContain(`${3 - RECENT_TURNS} more`);
  });
});

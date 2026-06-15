// U7 — the terminal-native transcript. The vitest env is node (no DOM), so we
// cover the PURE grouping/mapping logic (blocks → runs; trace actions → rows;
// source selection) plus a renderToStaticMarkup smoke of the run list. The
// terminal stays the live conversation — these never touch the PTY path.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionTraceAction } from "@zuzuu-web/protocol";
import type { Block } from "./blocks";
import { RunGroup } from "./Transcript";
import {
  RUN_GAP_MS,
  blockRows,
  traceRows,
  traceActionRow,
  groupRuns,
  runOutcome,
  transcriptSourceFor,
  type ReceiptRow,
} from "./transcript-model";

// A minimal block factory (only the fields the model reads).
function block(p: Partial<Block> & { id: number; command: string }): Block {
  return {
    id: p.id,
    command: p.command,
    outputStart: 0,
    outputEnd: p.outputEnd ?? 1,
    exitCode: "exitCode" in p ? (p.exitCode ?? null) : 0,
    startedAt: p.startedAt ?? 0,
    durationMs: p.durationMs ?? 100,
  };
}

describe("transcriptSourceFor (source selection by session type)", () => {
  it("shell → live OSC-133 blocks", () => {
    expect(transcriptSourceFor("shell")).toBe("blocks");
  });
  it("agent → post-hoc captured trace", () => {
    expect(transcriptSourceFor("agent")).toBe("trace");
  });
});

describe("blockRows (shell source)", () => {
  it("drops empty-command blocks and maps the rest to receipt rows", () => {
    const rows = blockRows([
      block({ id: 1, command: "npm test", durationMs: 500 }),
      block({ id: 2, command: "   " }), // empty → dropped
      block({ id: 3, command: "git status", durationMs: 50 }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["b1", "b3"]);
    expect(rows[0]!.receipt.label).toBe("npm test");
    expect(rows[0]!.body).toBe("$ npm test");
  });

  it("a failing block reads as a bad-tone receipt", () => {
    const [row] = blockRows([block({ id: 1, command: "npm test", exitCode: 1 })]);
    expect(row!.receipt.tone).toBe("bad");
  });

  it("a still-running block (exitCode null) reads as running", () => {
    const [row] = blockRows([block({ id: 1, command: "npm run dev", exitCode: null })]);
    expect(row!.receipt.running).toBe(true);
  });
});

describe("groupRuns (shell session: blocks group into runs)", () => {
  it("commands within the idle gap form one run", () => {
    const rows = blockRows([
      block({ id: 1, command: "ls", startedAt: 1000 }),
      block({ id: 2, command: "cd src", startedAt: 2000 }),
    ]);
    const runs = groupRuns(rows);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.rows).toHaveLength(2);
  });

  it("a command after an idle gap starts a new run (history of runs)", () => {
    const rows = blockRows([
      block({ id: 1, command: "ls", startedAt: 1000 }),
      block({ id: 2, command: "npm test", startedAt: 1000 + RUN_GAP_MS + 1 }),
    ]);
    const runs = groupRuns(rows);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.startedAt).toBe(1000);
    expect(runs[1]!.startedAt).toBe(1000 + RUN_GAP_MS + 1);
  });

  it("run outcome is bad when any row failed, else running, else ok", () => {
    expect(runOutcome([{ key: "a", receipt: { label: "", meta: null, tone: "ok", glyph: "run", running: false } }])).toBe("ok");
    const bad: ReceiptRow[] = [
      { key: "a", receipt: { label: "", meta: null, tone: "ok", glyph: "run", running: false } },
      { key: "b", receipt: { label: "", meta: null, tone: "bad", glyph: "run", running: false } },
    ];
    expect(runOutcome(bad)).toBe("bad");
    const running: ReceiptRow[] = [
      { key: "a", receipt: { label: "", meta: null, tone: "default", glyph: "run", running: true } },
    ];
    expect(runOutcome(running)).toBe("running");
  });
});

describe("traceRows (agent session: no blocks → render from trace)", () => {
  const actions: SessionTraceAction[] = [
    { kind: "turn", label: "User asked to add a test", ts: "2026-06-15T10:00:00.000Z" },
    { kind: "tool", label: "Bash: npm test", ts: "2026-06-15T10:00:05.000Z", status: "ok" },
    { kind: "tool", label: "Edit transcript.ts", ts: "2026-06-15T10:00:30.000Z", status: "error" },
  ];

  it("maps each action to a receipt row with kind-driven meta + status tone", () => {
    const rows = traceRows(actions);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.receipt.meta).toBe("turn");
    expect(rows[1]!.receipt.meta).toBe("tool");
    expect(rows[1]!.receipt.tone).toBe("ok");
    expect(rows[2]!.receipt.tone).toBe("bad");
  });

  it("trace rows are never 'running' (historical, post-hoc)", () => {
    expect(traceRows(actions).every((r) => r.receipt.running === false)).toBe(true);
  });

  it("glyph reflects the action label class (edit/search/git/bash)", () => {
    expect(traceActionRow({ kind: "tool", label: "Edit foo.ts", ts: "2026-06-15T10:00:00Z" }, 0).receipt.glyph).toBe("edit");
    expect(traceActionRow({ kind: "tool", label: "Grep for TODO", ts: "2026-06-15T10:00:00Z" }, 0).receipt.glyph).toBe("search");
    expect(traceActionRow({ kind: "tool", label: "git commit", ts: "2026-06-15T10:00:00Z" }, 0).receipt.glyph).toBe("git");
    expect(traceActionRow({ kind: "tool", label: "Bash: rm -rf", ts: "2026-06-15T10:00:00Z" }, 0).receipt.glyph).toBe("guardrail");
  });

  it("empty trace → no rows (the view shows the live-terminal affordance, not rows)", () => {
    expect(traceRows([])).toEqual([]);
  });

  it("rows with sparse/missing timestamps still group coherently (no throw)", () => {
    const sparse: SessionTraceAction[] = [
      { kind: "turn", label: "a", ts: "not-a-date" },
      { kind: "tool", label: "b", ts: "2026-06-15T10:00:00.000Z", status: "ok" },
    ];
    const runs = groupRuns(traceRows(sparse));
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs.flatMap((r) => r.rows)).toHaveLength(2);
  });
});

describe("RunGroup render (smoke — node SSR, no DOM)", () => {
  it("renders run rows + a clock header for a timestamped run", () => {
    // Render the pure RunGroup via the exported Transcript building blocks by
    // building markup from a known run — we verify labels survive to the DOM.
    const rows = blockRows([
      block({ id: 1, command: "npm test", startedAt: Date.UTC(2026, 5, 15, 10, 0, 0), durationMs: 1200 }),
    ]);
    const runs = groupRuns(rows);
    const html = renderToStaticMarkup(<RunGroup run={runs[0]!} />);
    expect(html).toContain("npm test");
    // a timestamped run shows a clock header (mono)
    expect(html).toContain("wc-mono");
  });
});

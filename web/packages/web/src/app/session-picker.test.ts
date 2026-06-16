// Pure-logic tests for the session picker (T3 U3).
// No DOM — only the pure functions from session-picker.ts.
import { describe, expect, it } from "vitest";
import type { ZuzuuSessionEntry } from "@zuzuu-web/protocol";
import {
  bandFor,
  filterPickerRows,
  groupRowsByBand,
  pickerCollapsedSummary,
  pickerRows,
  resolveViewed,
  sessionDisplayName,
  type LiveTab,
  type PickerRow,
} from "./session-picker";

// ── fixtures ──────────────────────────────────────────────────────────────────

const NOW = 1_718_000_000_000; // fixed epoch for determinism

function makeSession(overrides: Partial<ZuzuuSessionEntry> & { id: string }): ZuzuuSessionEntry {
  return {
    host: "claude-code",
    state: "completed",
    startedAt: new Date(NOW - 1_000).toISOString(),
    durationMs: null,
    ptyId: null,
    ...overrides,
  } as unknown as ZuzuuSessionEntry;
}

const liveTab: LiveTab = { id: "tab-live", type: "agent", alive: true };

// ── bandFor ───────────────────────────────────────────────────────────────────

describe("bandFor", () => {
  it("live session → now", () => {
    const s = makeSession({ id: "s1", state: "active" });
    expect(bandFor(s, true, NOW)).toBe("now");
  });

  it("active-state session (not live in workbench) → now", () => {
    const s = makeSession({ id: "s2", state: "active" });
    expect(bandFor(s, false, NOW)).toBe("now");
  });

  it("completed session < 24 h → recent", () => {
    const s = makeSession({ id: "s3", state: "completed", startedAt: new Date(NOW - 3_600_000).toISOString() });
    expect(bandFor(s, false, NOW)).toBe("recent");
  });

  it("completed session >= 24 h → older", () => {
    const s = makeSession({ id: "s4", state: "completed", startedAt: new Date(NOW - 90_000_000).toISOString() });
    expect(bandFor(s, false, NOW)).toBe("older");
  });

  it("null startedAt → older (safe fallback)", () => {
    const s = makeSession({ id: "s5", state: "completed", startedAt: null as unknown as string });
    expect(bandFor(s, false, NOW)).toBe("older");
  });
});

// ── pickerRows bands ──────────────────────────────────────────────────────────

describe("pickerRows band grouping", () => {
  const sNow = makeSession({ id: "now1", state: "active", startedAt: new Date(NOW - 500).toISOString() });
  const sRecent = makeSession({ id: "rec1", state: "completed", startedAt: new Date(NOW - 3_600_000).toISOString() });
  const sOlder = makeSession({ id: "old1", state: "completed", startedAt: new Date(NOW - 100_000_000).toISOString() });

  it("assigns correct bands", () => {
    const rows = pickerRows([sNow, sRecent, sOlder], [], NOW);
    expect(rows.find((r) => r.session.id === "now1")?.band).toBe("now");
    expect(rows.find((r) => r.session.id === "rec1")?.band).toBe("recent");
    expect(rows.find((r) => r.session.id === "old1")?.band).toBe("older");
  });

  it("orders: now → recent → older", () => {
    const rows = pickerRows([sOlder, sRecent, sNow], [], NOW);
    expect(rows.map((r) => r.band)).toEqual(["now", "recent", "older"]);
  });

  it("within a band, newest startedAt first", () => {
    const sRec2 = makeSession({ id: "rec2", state: "completed", startedAt: new Date(NOW - 7_200_000).toISOString() });
    const rows = pickerRows([sRec2, sRecent], [], NOW);
    // rec1 started more recently (less ago) so it should come first
    expect(rows[0]?.session.id).toBe("rec1");
    expect(rows[1]?.session.id).toBe("rec2");
  });

  it("empty sessions list → empty rows", () => {
    expect(pickerRows([], [], NOW)).toEqual([]);
  });
});

// ── groupRowsByBand ───────────────────────────────────────────────────────────

describe("groupRowsByBand", () => {
  it("produces three keys always: now, recent, older", () => {
    const groups = groupRowsByBand([]);
    expect([...groups.keys()]).toEqual(["now", "recent", "older"]);
  });

  it("puts rows into correct buckets", () => {
    const sNow = makeSession({ id: "n1", state: "active" });
    const sRec = makeSession({ id: "r1", state: "completed", startedAt: new Date(NOW - 3_600_000).toISOString() });
    const sOld = makeSession({ id: "o1", state: "completed", startedAt: new Date(NOW - 100_000_000).toISOString() });
    const rows = pickerRows([sNow, sRec, sOld], [], NOW);
    const groups = groupRowsByBand(rows);
    expect(groups.get("now")!.map((r) => r.session.id)).toEqual(["n1"]);
    expect(groups.get("recent")!.map((r) => r.session.id)).toEqual(["r1"]);
    expect(groups.get("older")!.map((r) => r.session.id)).toEqual(["o1"]);
  });

  it("preserves within-band order from pickerRows", () => {
    const s1 = makeSession({ id: "r1", state: "completed", startedAt: new Date(NOW - 1_800_000).toISOString() });
    const s2 = makeSession({ id: "r2", state: "completed", startedAt: new Date(NOW - 3_600_000).toISOString() });
    const rows = pickerRows([s1, s2], [], NOW);
    const groups = groupRowsByBand(rows);
    const recent = groups.get("recent")!;
    expect(recent[0]?.session.id).toBe("r1"); // newer first
    expect(recent[1]?.session.id).toBe("r2");
  });
});

// ── pickerCollapsedSummary ────────────────────────────────────────────────────

describe("pickerCollapsedSummary", () => {
  const s1 = makeSession({ id: "s1", host: "claude-code", state: "completed" });
  const s2 = makeSession({ id: "s2", host: "opencode", state: "completed" });
  const rows: PickerRow[] = [
    { session: s1, live: false, band: "recent" },
    { session: s2, live: false, band: "older" },
  ];
  const viewed: PickerRow = rows[0]!;

  it("uses the viewed session's host as label", () => {
    const summary = pickerCollapsedSummary(rows, viewed);
    expect(summary.label).toBe("claude-code");
  });

  it("counts all rows for total + countLabel", () => {
    const summary = pickerCollapsedSummary(rows, viewed);
    expect(summary.total).toBe(2);
    expect(summary.countLabel).toBe("2 sessions");
  });

  it("singular form for exactly one session", () => {
    const summary = pickerCollapsedSummary([rows[0]!], viewed);
    expect(summary.countLabel).toBe("1 session");
  });

  it("falls back to 'session' when no viewed row", () => {
    const summary = pickerCollapsedSummary(rows, null);
    expect(summary.label).toBe("session");
  });

  it("zero rows → 0 sessions", () => {
    const summary = pickerCollapsedSummary([], null);
    expect(summary.total).toBe(0);
    expect(summary.countLabel).toBe("0 sessions");
  });

  it("uses host from viewed session, not the first row", () => {
    const summary = pickerCollapsedSummary(rows, rows[1]!);
    expect(summary.label).toBe("opencode");
  });
});

// ── resolveViewed (existing logic, regression) ─────────────────────────────

describe("resolveViewed", () => {
  const sA = makeSession({ id: "a", state: "active" });
  const sB = makeSession({ id: "b", state: "completed" });
  const rows: PickerRow[] = [
    { session: sA, live: true, band: "now" },
    { session: sB, live: false, band: "recent" },
  ];

  it("returns null for empty rows", () => {
    expect(resolveViewed([], null)).toBeNull();
  });

  it("explicit selection wins when row exists", () => {
    expect(resolveViewed(rows, "b")?.session.id).toBe("b");
  });

  it("falls back to first row when selectedId not found", () => {
    expect(resolveViewed(rows, "missing")?.session.id).toBe("a");
  });

  it("falls back to first row when selectedId is null", () => {
    expect(resolveViewed(rows, null)?.session.id).toBe("a");
  });
});

// ── selecting a row collapses (pure state logic) ──────────────────────────────
// The collapse-on-select behaviour is UI state in SessionPicker; here we just
// verify that after calling onSelect the selectedId changes to the picked row.
// (The actual collapse toggle is tested via the render smoke in session-picker.test.tsx
// if needed — but the spec calls for pure-logic tests only for this file.)
describe("selection sets the viewed session", () => {
  it("resolveViewed returns the newly selected row immediately", () => {
    const sA = makeSession({ id: "a", state: "active" });
    const sB = makeSession({ id: "b", state: "completed" });
    const rows: PickerRow[] = [
      { session: sA, live: true, band: "now" },
      { session: sB, live: false, band: "recent" },
    ];
    // simulate: user picks 'b'
    const viewed = resolveViewed(rows, "b");
    expect(viewed?.session.id).toBe("b");
  });
});

// ── W1-A: filtering the session list by a free-text query ─────────────────────
describe("filterPickerRows", () => {
  const rows: PickerRow[] = [
    { session: makeSession({ id: "aaa111", host: "claude-code", state: "active", git: { commit: null, branch: "zz/session-aaa111" } }), live: true, band: "now" },
    { session: makeSession({ id: "bbb222", host: "gemini-cli", state: "completed", git: { commit: null, branch: "zz/session-bbb222" } }), live: false, band: "recent" },
    { session: makeSession({ id: "ccc333", host: "codex", state: "crashed", git: { commit: null, branch: null } }), live: false, band: "older" },
  ];

  it("a blank query returns all rows unchanged", () => {
    expect(filterPickerRows(rows, "")).toEqual(rows);
    expect(filterPickerRows(rows, "   ")).toEqual(rows);
  });

  it("matches the host case-insensitively", () => {
    expect(filterPickerRows(rows, "CLAUDE").map((r) => r.session.id)).toEqual(["aaa111"]);
    expect(filterPickerRows(rows, "gemini").map((r) => r.session.id)).toEqual(["bbb222"]);
  });

  it("matches the session state", () => {
    expect(filterPickerRows(rows, "crashed").map((r) => r.session.id)).toEqual(["ccc333"]);
  });

  it("matches the git branch", () => {
    expect(filterPickerRows(rows, "session-bbb").map((r) => r.session.id)).toEqual(["bbb222"]);
  });

  it("matches the session id", () => {
    expect(filterPickerRows(rows, "ccc333").map((r) => r.session.id)).toEqual(["ccc333"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterPickerRows(rows, "zzz-nope")).toEqual([]);
  });
});

// ── W1-B: session display name (user label wins over the host title) ───────────
describe("sessionDisplayName", () => {
  it("uses the user label when set", () => {
    expect(sessionDisplayName({ label: "fix auth bug", host: "claude-code" })).toBe("fix auth bug");
  });
  it("maps a known spawn host to its friendly title", () => {
    expect(sessionDisplayName({ host: "claude" })).toBe("Claude Code");
  });
  it("passes an unmapped host through (trace host names)", () => {
    expect(sessionDisplayName({ host: "claude-code" })).toBe("claude-code");
  });
  it("ignores a blank label, using the host", () => {
    expect(sessionDisplayName({ label: "   ", host: "gemini" })).toBe("Gemini CLI");
  });
  it("falls back to 'agent' when neither label nor host", () => {
    expect(sessionDisplayName({})).toBe("agent");
  });
});

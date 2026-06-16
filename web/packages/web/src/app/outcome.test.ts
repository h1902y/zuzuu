// W2a: deterministic outcome card — fold a session's counts + its resolved diff
// totals into one flat shape for the OutcomeCard. Pure; null diff → zeroed diff.
import { describe, expect, it } from "vitest";
import type { ZuzuuSessionEntry } from "@zuzuu-web/protocol";
import { summarizeOutcome } from "./outcome";

const session = (over: Partial<ZuzuuSessionEntry> = {}): ZuzuuSessionEntry => ({
  id: "s1",
  counts: { turns: 4, tools: 9, errors: 1 },
  durationMs: 65_000,
  ...over,
});

describe("summarizeOutcome", () => {
  it("with diff totals: pulls files/+/- from the diff and counts/duration from the session", () => {
    expect(summarizeOutcome(session(), { files: 3, additions: 42, deletions: 7 })).toEqual({
      files: 3,
      additions: 42,
      deletions: 7,
      turns: 4,
      tools: 9,
      errors: 1,
      durationMs: 65_000,
    });
  });

  it("without diff totals (null): diff fields default to 0, counts still from session", () => {
    expect(summarizeOutcome(session(), null)).toEqual({
      files: 0,
      additions: 0,
      deletions: 0,
      turns: 4,
      tools: 9,
      errors: 1,
      durationMs: 65_000,
    });
  });

  it("absent session counts/duration degrade to 0/null", () => {
    expect(summarizeOutcome({ id: "s2" }, null)).toEqual({
      files: 0,
      additions: 0,
      deletions: 0,
      turns: 0,
      tools: 0,
      errors: 0,
      durationMs: null,
    });
  });
});

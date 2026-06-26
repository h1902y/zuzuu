// U1 — characterization + fix for stagedSummary's field reconciliation.
//
// The on-disk staged record (golden, pasted from a real `node bin/zuzuu.mjs observe`
// run — see U1 in docs/plans/2026-06-26-002) writes the body under `change`, NOT
// `candidate`/`payload`. The old stagedSummary read `candidate`/`payload`, so every
// mined proposal fell back to `id` for title/preview and surfaced no rationale.
// These tests pin the real shape → the expanded DTO.
import { describe, it, expect } from "vitest";
import { stagedSummary } from "../../src/server/zuzuu-peek.js";

// A REAL mined record (golden — pasted verbatim from a real observe run, never hand-computed).
const MINED_ACTION = {
  id: "stg-34901c54",
  op: "create",
  module: "actions",
  target: "command-npm-test",
  change: {
    type: "action",
    title: "Run `npm test`",
    run: "npm test",
    body: "Recurring project command: `npm test` (used 4× across 3 sessions, failed 1×).",
  },
  rationale: "Recurring project command: `npm test` (used 4× across 3 sessions, failed 1×).",
  evidence: [{ kind: "command", occurrences: 4, sessions: 3, failures: 1 }],
  confidence: null,
  score: 43,
  status: "pending",
};

const MINED_GUARDRAIL = {
  id: "stg-b6f66458",
  op: "create",
  module: "instructions",
  target: "guard-rm-rf-dist",
  change: {
    type: "rule",
    title: "Confirm before `rm -rf dist`",
    action: "ask",
    tool: "Bash",
    pattern: "rm -rf dist",
    reason: "recurring destructive command (mined)",
    body: "`rm -rf dist` is a destructive command that failed across 2 sessions — propose an ask-gate so it's confirmed, not run unprompted.",
  },
  rationale: "`rm -rf dist` is a destructive command that failed across 2 sessions — propose an ask-gate so it's confirmed, not run unprompted.",
  evidence: [{ kind: "guardrail", occurrences: 2, sessions: 2 }],
  confidence: null,
  score: 4,
  status: "pending",
};

describe("stagedSummary — a real observe-written record (body under `change`)", () => {
  it("resolves the title from change.title, not a fallback to the id", () => {
    const s = stagedSummary(MINED_ACTION, "actions");
    expect(s.title).toBe("Run `npm test`");
    expect(s.title).not.toBe(s.id); // the latent bug fell back to id
  });

  it("resolves an action preview to its run command (the WHAT that lands)", () => {
    const s = stagedSummary(MINED_ACTION, "actions");
    expect(s.preview).toBe("npm test");
  });

  it("projects rationale, evidence, op, target, and change onto the DTO", () => {
    const s = stagedSummary(MINED_ACTION, "actions");
    expect(s.rationale).toBe(MINED_ACTION.rationale);
    expect(s.evidence).toEqual(MINED_ACTION.evidence);
    expect(s.op).toBe("create");
    expect(s.target).toBe("command-npm-test"); // the diff's update-before id source
    expect(s.change).toEqual(MINED_ACTION.change);
  });

  it("surfaces confidence honestly from the top-level field (null today, not faked from score)", () => {
    const s = stagedSummary(MINED_ACTION, "actions");
    // score is a NUMBER (43); the old code read score.confidence → always dead.
    // confidence is the real top-level field — null until a producer sets it.
    expect(s.confidence ?? null).toBeNull();
  });

  it("renders a guardrail rule preview as pattern → action", () => {
    const s = stagedSummary(MINED_GUARDRAIL, "instructions");
    expect(s.title).toBe("Confirm before `rm -rf dist`");
    expect(s.preview).toBe("rm -rf dist → ask");
  });
});

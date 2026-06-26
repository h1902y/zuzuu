// U1 — reasonLine: a pure template over ROUTE kind + evidence (KTD2).
import { describe, it, expect } from "vitest";
import { reasonLine } from "../../src/client/shell/review/reason-line.js";
import type { StagedEvidence } from "#shared/index.js";

const ev = (kind: string, sessions: number): StagedEvidence[] => [{ kind, sessions }];

describe("reasonLine — one sentence per ROUTE kind", () => {
  it("command → save-as-action", () => {
    expect(reasonLine("command", ev("command", 3))).toBe(
      "Because you ran this command in 3 sessions, I want to save it as a reusable action.",
    );
  });

  it("workflow → save-as-action", () => {
    expect(reasonLine("workflow", ev("workflow", 3))).toBe(
      "Because you ran this sequence in 3 sessions, I want to save it as a reusable action.",
    );
  });

  it("entity → remember-as-knowledge", () => {
    expect(reasonLine("entity", ev("entity", 4))).toBe(
      "Because you touched this file in 4 sessions, I want to remember it as project knowledge.",
    );
  });

  it("fact → remember-as-knowledge", () => {
    expect(reasonLine("fact", ev("fact", 3))).toBe(
      "Because you hit this in 3 sessions, I want to remember it as project knowledge.",
    );
  });

  it("guardrail → ask-before gate", () => {
    expect(reasonLine("guardrail", ev("guardrail", 2))).toBe(
      "Because you ran a destructive command in 2 sessions, I want to add an ask-before gate.",
    );
  });

  it("correction → standing guidance", () => {
    expect(reasonLine("correction", ev("correction", 2))).toBe(
      "Because you made this correction in 2 sessions, I want to make it standing guidance.",
    );
  });
});

describe("reasonLine — fallbacks and pluralization", () => {
  it("unknown kind → a neutral statement of fact, never a misleading sentence", () => {
    expect(reasonLine("mystery", ev("mystery", 3))).toBe("Recurring signal across 3 sessions");
  });

  it("undefined kind → the neutral fallback too", () => {
    expect(reasonLine(undefined, undefined)).toBe("Recurring signal across 1 session");
  });

  it("singular session reads 'session', plural reads 'sessions'", () => {
    expect(reasonLine("command", ev("command", 1))).toContain("in 1 session,");
    expect(reasonLine("command", ev("command", 2))).toContain("in 2 sessions,");
  });

  it("missing/zero evidence count floors at 1 session (corroborated by construction)", () => {
    expect(reasonLine("command", [])).toContain("in 1 session,");
    expect(reasonLine("command", [{ kind: "command" }])).toContain("in 1 session,");
  });
});

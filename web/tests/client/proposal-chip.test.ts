// shell/review/proposal-chip — the type→chip mapping (type wins over module).
import { describe, it, expect } from "vitest";
import { proposalChip } from "../../src/client/shell/review/proposal-chip.js";

describe("proposalChip", () => {
  it("a rule note reads as Guardrail even when it lives in the instructions module", () =>
    expect(proposalChip("rule", "instructions")).toEqual({ label: "Guardrail", tone: "guardrails" }));
  it("knowledge type → Knowledge", () =>
    expect(proposalChip("knowledge", "knowledge")).toEqual({ label: "Knowledge", tone: "knowledge" }));
  it("action type → Action", () =>
    expect(proposalChip("action", "actions")).toEqual({ label: "Action", tone: "actions" }));
  it("no type → falls back to the module", () =>
    expect(proposalChip(undefined, "memory")).toEqual({ label: "Memory", tone: "memory" }));
  it("unknown type + unknown module → neutral pill of the module name", () =>
    expect(proposalChip("mystery", "scratch")).toEqual({ label: "scratch", tone: "neutral" }));
  it("empty module + no type → a neutral Note pill", () =>
    expect(proposalChip(undefined, "")).toEqual({ label: "Note", tone: "neutral" }));
});

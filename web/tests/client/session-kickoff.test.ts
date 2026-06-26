// composer/session-kickoff — the kickoff message + the fire predicate + the registry.
import { describe, it, expect } from "vitest";
import {
  kickoffMessage,
  shouldFireKickoff,
  requestKickoff,
  isKickoffPending,
  takeKickoff,
} from "../../src/client/composer/session-kickoff.js";

describe("kickoffMessage", () => {
  it("orients the agent and asks it to self-check with zz doctor", () => {
    const m = kickoffMessage("cards-game");
    expect(m).toMatch(/zz doctor/);
    expect(m).toMatch(/cards-game/);
    expect(m).toMatch(/zuzuu/);
  });
  it("is a single line — no embedded newline that could submit early", () => {
    expect(kickoffMessage()).not.toMatch(/\n/);
  });
});

describe("shouldFireKickoff", () => {
  it("fires only when pending AND ready AND the agent is up", () => {
    expect(shouldFireKickoff({ pending: true, ready: true, agentUp: true })).toBe(true);
  });
  it("holds while the agent is still booting (not up)", () => {
    expect(shouldFireKickoff({ pending: true, ready: true, agentUp: false })).toBe(false);
  });
  it("holds while the agent is busy (not ready)", () => {
    expect(shouldFireKickoff({ pending: true, ready: false, agentUp: true })).toBe(false);
  });
  it("never fires when nothing is pending", () => {
    expect(shouldFireKickoff({ pending: false, ready: true, agentUp: true })).toBe(false);
  });
});

describe("the pending registry", () => {
  it("request → pending; take → consumed once", () => {
    requestKickoff("s1");
    expect(isKickoffPending("s1")).toBe(true);
    expect(takeKickoff("s1")).toBe(true);
    expect(isKickoffPending("s1")).toBe(false);
    expect(takeKickoff("s1")).toBe(false); // idempotent
  });
});

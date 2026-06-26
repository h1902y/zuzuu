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
  it("with readiness: embeds the pre-run digest + doctor output, no self-check ask", () => {
    const m = kickoffMessage({ projectName: "cards-game", readiness: { doctor: "✓ healthy", digest: "8 notes" } });
    expect(m).toMatch(/cards-game/);
    expect(m).toMatch(/✓ healthy/);
    expect(m).toMatch(/8 notes/);
    expect(m).toMatch(/already run the readiness checks/);
    expect(m).not.toMatch(/run `zz doctor`/); // we ran it — don't ask the agent to
  });
  it("a partial readiness (digest only) still embeds what it has", () => {
    const m = kickoffMessage({ readiness: { digest: "where it stands", doctor: null } });
    expect(m).toMatch(/where it stands/);
    expect(m).not.toMatch(/── zz doctor ──/);
  });
  it("fallback (no readiness): single line asking the agent to self-check", () => {
    const m = kickoffMessage();
    expect(m).toMatch(/zz doctor/);
    expect(m).not.toMatch(/\n/); // single line — no premature-submit risk
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

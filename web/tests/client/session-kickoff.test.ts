// composer/session-kickoff — the kickoff message + the fire predicate + the registry.
import { describe, it, expect } from "vitest";
import {
  kickoffMessage,
  doctorVerdict,
  pendingFromDigest,
  shouldFireKickoff,
  requestKickoff,
  isKickoffPending,
  takeKickoff,
} from "../../src/client/composer/session-kickoff.js";

const DOCTOR = [
  "  · git: on main @ abc123",
  "  · home: /x/.zuzuu (2 modules)",
  "  ⚠ leftover session branch zz/session-7ce8459f",
  "",
  "✓ healthy (1 warning)",
].join("\n");

describe("doctorVerdict", () => {
  it("extracts the ✓ summary line, not the per-warning lines", () =>
    expect(doctorVerdict(DOCTOR)).toBe("✓ healthy (1 warning)"));
  it("extracts the ✗ verdict (the digit guard skips per-problem ✗ lines)", () =>
    expect(doctorVerdict("  ✗ a broken thing\n\n✗ 2 problem(s)")).toBe("✗ 2 problem(s)"));
  it("null when there's no doctor text", () => expect(doctorVerdict(null)).toBeNull());
});

describe("pendingFromDigest", () => {
  it("parses the awaiting-review count", () =>
    expect(pendingFromDigest("# brief\n12 proposal(s) awaiting review: zz review")).toBe(12));
  it("0 when the brief shows none", () => expect(pendingFromDigest("# brief\nzuzuu[1]...")).toBe(0));
  it("null when there's no digest", () => expect(pendingFromDigest(null)).toBeNull());
});

describe("kickoffMessage", () => {
  it("with readiness: a single line carrying the verdict + pending, no pasted wall", () => {
    const m = kickoffMessage({ projectName: "cards-game", readiness: { doctor: DOCTOR, digest: "5 proposal(s) awaiting review" } });
    expect(m).toMatch(/cards-game/);
    expect(m).toMatch(/✓ healthy \(1 warning\)/);
    expect(m).toMatch(/5 pending review/);
    expect(m).not.toMatch(/\n/); // trimmed to one line
    expect(m).not.toMatch(/run `zz doctor`/); // we ran it — don't ask the agent to
  });
  it("fallback (no readiness): single line asking the agent to self-check", () => {
    const m = kickoffMessage();
    expect(m).toMatch(/zz doctor/);
    expect(m).not.toMatch(/\n/);
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

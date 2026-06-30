// U1 — the natural-exit edge-detector (plan 2026-06-29-001). Pure: which agent sessions
// went live → ended between two list snapshots. Proves exactly-once edge semantics, the
// alive:false vs removed cases, and that shells / already-dead / still-live don't fire.
import { describe, it, expect } from "vitest";
import type { SessionInfo } from "#shared/index.js";
import { liveAgentIds, endedAgentSessions } from "../../src/client/shell/review/session-liveness.js";

// minimal SessionInfo — the detector reads only id / type / alive
const s = (id: string, type: "agent" | "shell", alive: boolean): SessionInfo =>
  ({ id, type, alive } as SessionInfo);

describe("endedAgentSessions — the live→ended edge", () => {
  it("reports a live agent that went alive:false (natural PTY exit, still in the list)", () => {
    const prev = liveAgentIds([s("a", "agent", true)]);
    expect(endedAgentSessions(prev, [s("a", "agent", false)])).toEqual(["a"]);
  });

  it("reports a live agent that dropped from the list (explicit close)", () => {
    const prev = liveAgentIds([s("a", "agent", true)]);
    expect(endedAgentSessions(prev, [])).toEqual(["a"]);
  });

  it("does NOT report a session that was never live (already dead at mount)", () => {
    const prev = liveAgentIds([s("a", "agent", false)]); // not live → not tracked
    expect(prev.size).toBe(0);
    expect(endedAgentSessions(prev, [s("a", "agent", false)])).toEqual([]);
  });

  it("does NOT report a shell session ending (agents only — zuzuu observes agents)", () => {
    const prev = liveAgentIds([s("sh", "shell", true)]);
    expect(prev.size).toBe(0); // shells aren't tracked
    expect(endedAgentSessions(prev, [s("sh", "shell", false)])).toEqual([]);
  });

  it("reports multiple agents that ended together", () => {
    const prev = liveAgentIds([s("a", "agent", true), s("b", "agent", true)]);
    expect(endedAgentSessions(prev, [s("a", "agent", false)]).sort()).toEqual(["a", "b"]);
  });

  it("is edge-triggered: a still-live agent isn't reported and stays in the live set", () => {
    const prev = liveAgentIds([s("a", "agent", true)]);
    const current = [s("a", "agent", true)];
    expect(endedAgentSessions(prev, current)).toEqual([]);
    expect(liveAgentIds(current).has("a")).toBe(true); // carries to the next prevLive
  });
});

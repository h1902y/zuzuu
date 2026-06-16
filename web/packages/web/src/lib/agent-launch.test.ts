// U1: start-with-a-task wiring. startAgentSession queues a non-blank prompt as
// the new session's first terminal input; blank prompts and focus-existing
// never inject.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionInfo } from "@zuzuu-web/protocol";

// Mock the REST client so create() doesn't hit fetch — return a deterministic
// session whose id we assert the pending input is keyed under. vi.hoisted so
// the fn exists when the hoisted vi.mock factory runs.
const { createSession } = vi.hoisted(() => ({
  createSession: vi.fn(
    async (req: { type?: string; host?: string }): Promise<SessionInfo> => ({
      id: "new-sid",
      title: "Claude Code",
      cwd: "/",
      alive: true,
      createdAt: 0,
      type: (req.type as SessionInfo["type"]) ?? "agent",
      host: req.host,
    }),
  ),
}));
vi.mock("../lib/api", () => ({ api: { createSession } }));

import { startAgentSession } from "./agent-launch";
import { useSessions } from "../state/sessions";
import { useOpenTabs } from "../state/open-tabs";
import { termRegistry } from "../term/registry";

const spec = { command: "claude", args: [], host: "claude" };

beforeEach(() => {
  createSession.mockClear();
  useSessions.setState({ tabs: [], activeId: null, loaded: false });
  useOpenTabs.setState({ openIds: [], activeId: null });
  termRegistry.clearPendingInput("new-sid");
});
afterEach(() => termRegistry.clearPendingInput("new-sid"));

describe("startAgentSession — injectPrompt queueing", () => {
  it("queues a non-blank injectPrompt as the new session's first input (ending in ↵)", async () => {
    await startAgentSession(spec, { injectPrompt: "fix the login bug" });
    expect(createSession).toHaveBeenCalledOnce();
    const queued = termRegistry.getPendingInput("new-sid");
    expect(queued).toBe("fix the login bug\r");
    expect(queued?.endsWith("\r")).toBe(true);
  });

  it("opens + focuses the new session as a center tab", async () => {
    await startAgentSession(spec, { injectPrompt: "do X" });
    expect(useOpenTabs.getState().openIds).toContain("new-sid");
    expect(useOpenTabs.getState().activeId).toBe("new-sid");
  });

  it("trims surrounding whitespace before queuing", async () => {
    await startAgentSession(spec, { injectPrompt: "  build the thing  " });
    expect(termRegistry.getPendingInput("new-sid")).toBe("build the thing\r");
  });

  it("does NOT queue a blank injectPrompt (host opens idle / argv-carried task)", async () => {
    await startAgentSession(spec, { injectPrompt: "   " });
    expect(createSession).toHaveBeenCalledOnce();
    expect(termRegistry.getPendingInput("new-sid")).toBeUndefined();
  });

  it("does NOT queue when no injectPrompt is given (argv-prompt hosts)", async () => {
    await startAgentSession(spec);
    expect(termRegistry.getPendingInput("new-sid")).toBeUndefined();
  });

  it("focuses an already-alive agent session — no spawn, no injection", async () => {
    useSessions.setState({
      tabs: [
        { id: "alive-1", title: "Claude Code", cwd: "/", alive: true, createdAt: 0, type: "agent", host: "claude" },
      ],
      activeId: null,
      loaded: true,
    });
    await startAgentSession(spec, { injectPrompt: "this should be ignored" });
    expect(createSession).not.toHaveBeenCalled();
    expect(useSessions.getState().activeId).toBe("alive-1");
    expect(termRegistry.getPendingInput("new-sid")).toBeUndefined();
    // surfaces the already-running session's tab instead of spawning a second
    expect(useOpenTabs.getState().activeId).toBe("alive-1");
  });
});

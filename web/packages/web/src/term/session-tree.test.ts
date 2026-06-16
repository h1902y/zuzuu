// W1-A: transcript search — pure filtering of session content nodes.
import { describe, expect, it } from "vitest";
import type { SessionContentNode } from "@zuzuu-web/protocol";
import { filterContentNodes } from "./session-tree";

const nodes: SessionContentNode[] = [
  { kind: "user_text", label: "you", ts: "t1", text: "fix the login bug" },
  { kind: "agent_text", label: "claude", ts: "t2", text: "I'll update auth.ts" },
  { kind: "tool", label: "Bash", ts: "t3", toolInput: "npm test", toolOutput: "3 passed" },
  { kind: "tool", label: "Write", ts: "t4", toolInput: "src/auth.ts", toolOutput: "ok" },
];

describe("filterContentNodes", () => {
  it("a blank query returns all nodes unchanged", () => {
    expect(filterContentNodes(nodes, "")).toEqual(nodes);
    expect(filterContentNodes(nodes, "  ")).toEqual(nodes);
  });

  it("matches text content", () => {
    expect(filterContentNodes(nodes, "login").map((n) => n.label)).toEqual(["you"]);
  });

  it("matches the node label (e.g. tool name)", () => {
    expect(filterContentNodes(nodes, "bash").map((n) => n.label)).toEqual(["Bash"]);
  });

  it("matches tool input", () => {
    expect(filterContentNodes(nodes, "auth.ts").map((n) => n.label).sort()).toEqual(["Write", "claude"]);
  });

  it("matches tool output", () => {
    expect(filterContentNodes(nodes, "3 passed").map((n) => n.label)).toEqual(["Bash"]);
  });

  it("is case-insensitive", () => {
    expect(filterContentNodes(nodes, "LOGIN").map((n) => n.label)).toEqual(["you"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterContentNodes(nodes, "nonexistent")).toEqual([]);
  });
});

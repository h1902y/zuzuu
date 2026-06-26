// T1.1 — the new-session menu model: "New shell" first, then one agent item per host.
import { describe, it, expect } from "vitest";
import { newSessionItems } from "../../src/client/shell/session/new-session-items.js";

describe("newSessionItems", () => {
  it("leads with New shell, then an agent item per host", () => {
    expect(newSessionItems([{ id: "claude", label: "Claude Code" }, { id: "gemini", label: "Gemini CLI" }])).toEqual([
      { key: "shell", label: "New shell", type: "shell" },
      { key: "claude", label: "Claude Code", type: "agent", host: "claude" },
      { key: "gemini", label: "Gemini CLI", type: "agent", host: "gemini" },
    ]);
  });
  it("with no hosts, just the shell", () => {
    expect(newSessionItems([])).toEqual([{ key: "shell", label: "New shell", type: "shell" }]);
  });
});

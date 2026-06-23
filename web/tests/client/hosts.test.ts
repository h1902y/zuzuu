import { describe, it, expect } from "vitest";
import { HOSTS } from "../../src/client/app/hosts.js";

// The daemon's command allowlist (server/server.ts DEFAULT_COMMAND_ALLOWLIST)
// minus "zuzuu" (the CLI itself, not a host agent). Guards the client list from
// drifting out of the daemon's accepted set.
const DAEMON_ALLOWLIST = new Set(["claude", "gemini", "codex", "pi", "opencode", "zuzuu"]);

describe("HOSTS", () => {
  it("lists the five host agents with id + label", () => {
    expect(HOSTS).toHaveLength(5);
    for (const h of HOSTS) {
      expect(typeof h.id).toBe("string");
      expect(typeof h.label).toBe("string");
    }
  });

  it("every host id is accepted by the daemon allowlist", () => {
    for (const h of HOSTS) expect(DAEMON_ALLOWLIST.has(h.id)).toBe(true);
  });
});

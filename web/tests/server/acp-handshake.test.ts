// Handshake smoke (U6 / R12 / ADV-3): pin the ACP wire contract + the adapter's
// presence so a dependency bump that breaks the import, the protocol version, or the
// bin resolution fails CI — not a live-verify session. The full initialize/newSession
// round-trip needs a logged-in Claude Code (covered by the live smoke, Spike #2); this
// asserts the pieces the pinned deps must provide for that round-trip to be possible.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { resolveAdapterBin } from "../../src/server/acp.js";

describe("ACP handshake smoke — the pinned deps provide the wire contract", () => {
  it("the SDK exports a defined PROTOCOL_VERSION (import + version pinned)", () => {
    expect(PROTOCOL_VERSION).toBeDefined();
    expect(["number", "string"]).toContain(typeof PROTOCOL_VERSION);
  });

  it("the adapter bin resolves to an existing file (optionalDependency installed)", () => {
    const bin = resolveAdapterBin();
    expect(bin).toMatch(/claude-agent-acp/);
    expect(fs.existsSync(bin)).toBe(true);
  });
});

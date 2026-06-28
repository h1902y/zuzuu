// U6 — provenanceOf: project a `source` pointer into the "born from" line (R6).
import { describe, it, expect } from "vitest";
import { provenanceOf, shortSession } from "../../src/client/shell/review/provenance.js";
import type { ProvenanceSource } from "#shared/index.js";

const src = (sessions: string[]): ProvenanceSource => ({
  producer: "observe", kind: "entity", sessions,
  locator: { kind: "session-ids", sessions },
});

describe("provenanceOf — the born-from line", () => {
  it("a single session → singular", () => {
    const p = provenanceOf(src(["claude-code:abc"]));
    expect(p?.label).toBe("Born from 1 session");
    expect(p?.sessions).toEqual(["claude-code:abc"]);
  });

  it("multiple sessions → plural, all ids carried", () => {
    const p = provenanceOf(src(["claude-code:a", "claude-code:b", "codex:c"]));
    expect(p?.label).toBe("Born from 3 sessions");
    expect(p?.sessions).toEqual(["claude-code:a", "claude-code:b", "codex:c"]);
  });

  it("de-dupes repeated ids and drops blanks, preserving order", () => {
    const p = provenanceOf(src(["claude-code:a", "", "claude-code:a", "claude-code:b"]));
    expect(p?.label).toBe("Born from 2 sessions");
    expect(p?.sessions).toEqual(["claude-code:a", "claude-code:b"]);
  });

  it("falls back to the locator's sessions when top-level is absent", () => {
    const p = provenanceOf({ locator: { kind: "session-ids", sessions: ["claude-code:x"] } });
    expect(p?.sessions).toEqual(["claude-code:x"]);
  });

  it("no source → null (render nothing)", () => {
    expect(provenanceOf(undefined)).toBeNull();
  });

  it("a source with no session ids → null (degrade, never an empty line)", () => {
    expect(provenanceOf({ producer: "observe", sessions: [] })).toBeNull();
    expect(provenanceOf({ producer: "observe" })).toBeNull();
  });

  it("shortSession keeps the host prefix and truncates a long opaque tail", () => {
    expect(shortSession("claude-code:0a1b2c3d4e5f6789")).toBe("claude-code:0a1b2c3d4e5f");
    expect(shortSession("claude-code:short")).toBe("claude-code:short");
    expect(shortSession("bare-id")).toBe("bare-id");
  });
});

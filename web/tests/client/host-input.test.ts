import { describe, it, expect } from "vitest";
import { hostInputProfile, DEFAULT_PROFILE } from "../../src/client/composer/host-input.js";

describe("hostInputProfile", () => {
  it("an unknown host → the default profile (defaults applied, unverified)", () => {
    expect(hostInputProfile("codex")).toEqual(DEFAULT_PROFILE);
    expect(hostInputProfile("codex").verified).toBe(false);
  });

  it("an absent host → the default profile", () => {
    expect(hostInputProfile(undefined)).toEqual(DEFAULT_PROFILE);
  });

  it("claude is the verified profile (overrides merged over the default)", () => {
    const p = hostInputProfile("claude");
    expect(p.verified).toBe(true);
    // behavioral fields stay the default-verified values
    expect(p.submit).toBe("\r");
    expect(p.quietMs).toBe(DEFAULT_PROFILE.quietMs);
    expect(p.multilinePaste).toBe(true);
  });

  it("never mutates the shared default/override objects", () => {
    const a = hostInputProfile("claude");
    a.quietMs = 9999;
    expect(hostInputProfile("claude").quietMs).toBe(DEFAULT_PROFILE.quietMs);
    expect(DEFAULT_PROFILE.quietMs).not.toBe(9999);
  });
});

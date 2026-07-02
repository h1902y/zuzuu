// lib/time.ts — the shared relative-time ladder (§G: pulled out of
// projects-model.ts so the module lineage strip + note history reuse it instead
// of a third hand-rolled copy).
import { describe, it, expect } from "vitest";
import { relativeTime, relativeTimeFromIso } from "../../src/client/lib/time.js";

describe("relativeTime", () => {
  const now = 1_700_000_000_000;
  it("0 → em dash", () => expect(relativeTime(0, now)).toBe("—"));
  it("under a minute → just now", () => expect(relativeTime(now - 30_000, now)).toBe("just now"));
  it("minutes", () => expect(relativeTime(now - 5 * 60_000, now)).toBe("5m ago"));
  it("hours", () => expect(relativeTime(now - 3 * 3_600_000, now)).toBe("3h ago"));
  it("days", () => expect(relativeTime(now - 2 * 86_400_000, now)).toBe("2d ago"));
  it("months", () => expect(relativeTime(now - 60 * 86_400_000, now)).toBe("2mo ago"));
  it("clamps a future timestamp to just now", () => expect(relativeTime(now + 5000, now)).toBe("just now"));
});

describe("relativeTimeFromIso", () => {
  const now = Date.parse("2026-07-02T12:00:00Z");
  it("null/undefined ts → the fallback (honest — most log entries carry ts:null today)", () => {
    expect(relativeTimeFromIso(null, now)).toBe("—");
    expect(relativeTimeFromIso(undefined, now)).toBe("—");
    expect(relativeTimeFromIso(null, now, "time not recorded")).toBe("time not recorded");
  });
  it("unparsable ts → the fallback, never a crash", () => {
    expect(relativeTimeFromIso("not-a-date", now, "time not recorded")).toBe("time not recorded");
  });
  it("a real ISO ts formats through the same ladder", () => {
    expect(relativeTimeFromIso("2026-07-02T11:55:00Z", now)).toBe("5m ago");
    expect(relativeTimeFromIso("2026-06-30T12:00:00Z", now)).toBe("2d ago");
  });
});

// shared/project-emoji — the deterministic default + override resolution.
import { describe, it, expect } from "vitest";
import { PROJECT_EMOJIS, defaultEmoji, emojiForProject } from "../../src/shared/project-emoji.js";

describe("defaultEmoji", () => {
  it("is drawn from the palette", () =>
    expect(PROJECT_EMOJIS).toContain(defaultEmoji("/a/cards-game")));
  it("is stable for the same path", () =>
    expect(defaultEmoji("/a/cards-game")).toBe(defaultEmoji("/a/cards-game")));
  it("varies across paths (not all the same)", () => {
    const got = new Set(["/a", "/b", "/c", "/d", "/e", "/f"].map(defaultEmoji));
    expect(got.size).toBeGreaterThan(1);
  });
  it("never throws on an empty path", () =>
    expect(PROJECT_EMOJIS).toContain(defaultEmoji("")));
});

describe("emojiForProject", () => {
  it("a non-empty override wins", () =>
    expect(emojiForProject("/a/x", "🦊")).toBe("🦊"));
  it("a blank/absent override falls back to the default", () => {
    expect(emojiForProject("/a/x", "")).toBe(defaultEmoji("/a/x"));
    expect(emojiForProject("/a/x", null)).toBe(defaultEmoji("/a/x"));
    expect(emojiForProject("/a/x")).toBe(defaultEmoji("/a/x"));
  });
});

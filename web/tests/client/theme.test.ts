// U1 — the dual-theme preference logic (pure). The store + the [data-theme] CSS swap
// are thin around these.
import { describe, it, expect } from "vitest";
import { resolveTheme, nextTheme } from "../../src/client/state/theme.js";

describe("resolveTheme", () => {
  it("system follows the OS dark setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  it("an explicit choice ignores the OS", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("nextTheme", () => {
  it("cycles light → dark → system → light", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
    expect(nextTheme("system")).toBe("light");
  });
});

import { describe, it, expect } from "vitest";
import { bracketedPaste } from "../../src/client/composer/composer-logic.js";

const START = "\x1b[200~";
const END = "\x1b[201~";

describe("bracketedPaste", () => {
  it("wraps text in bracketed-paste delimiters + a trailing CR", () => {
    expect(bracketedPaste("hello")).toBe(`${START}hello${END}\r`);
  });

  it("preserves newlines INSIDE the brackets (one paste, not line-by-line)", () => {
    const out = bracketedPaste("a\nb");
    expect(out).toBe(`${START}a\nb${END}\r`);
    // exactly one trailing CR — the inner newline is content, never a submit
    expect(out.endsWith(`b${END}\r`)).toBe(true);
    expect([...out].filter((c) => c === "\r")).toHaveLength(1);
  });

  it("passes content through unchanged (no sanitizing of a literal end-marker)", () => {
    const tricky = `x${END}y`;
    expect(bracketedPaste(tricky)).toBe(`${START}${tricky}${END}\r`);
  });

  it("empty string still produces an empty bracketed paste + CR", () => {
    expect(bracketedPaste("")).toBe(`${START}${END}\r`);
  });
});

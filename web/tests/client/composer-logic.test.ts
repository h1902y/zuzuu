import { describe, it, expect } from "vitest";
import { inputFrames, pasteBlock, isReady, QUIET_MS, SUBMIT_DELAY_MS } from "../../src/client/composer/composer-logic.js";

const START = "\x1b[200~";
const END = "\x1b[201~";

describe("inputFrames", () => {
  it("single-line: raw keystrokes as the body, CR as a SEPARATE submit", () => {
    expect(inputFrames("hello")).toEqual({ body: "hello", submit: "\r" });
  });

  it("multi-line: ONE bracketed-paste block, CR still a separate submit", () => {
    expect(inputFrames("a\nb")).toEqual({ body: `${START}a\nb${END}`, submit: "\r" });
  });

  it("the body NEVER carries the submit — that's the whole fix", () => {
    expect(inputFrames("hi").body).not.toContain("\r");
    expect([...inputFrames("a\nb").body].filter((c) => c === "\r")).toHaveLength(0);
    expect(inputFrames("a\nb").submit).toBe("\r");
  });

  it("passes content through unchanged (no sanitizing of a literal end-marker)", () => {
    const tricky = `x${END}y\nz`; // multi-line → paste-framed
    expect(inputFrames(tricky).body).toBe(`${START}${tricky}${END}`);
  });

  it("empty string → empty body + a CR submit", () => {
    expect(inputFrames("")).toEqual({ body: "", submit: "\r" });
  });

  it("SUBMIT_DELAY_MS is a small positive settle window", () => {
    expect(SUBMIT_DELAY_MS).toBeGreaterThan(0);
    expect(SUBMIT_DELAY_MS).toBeLessThan(500);
  });
});

describe("pasteBlock", () => {
  it("wraps in bracketed-paste delimiters with NO trailing CR (submit is separate)", () => {
    expect(pasteBlock("x")).toBe(`${START}x${END}`);
    expect(pasteBlock("x")).not.toContain("\r");
  });
});

describe("isReady (output quiescence)", () => {
  it("is busy just after output, ready once the quiet window passes", () => {
    expect(isReady(1000, 1000 + 100, 600)).toBe(false); // 100ms after output → busy
    expect(isReady(1000, 1000 + 600, 600)).toBe(true); // exactly the window → ready
    expect(isReady(1000, 1000 + 900, 600)).toBe(true);
  });

  it("defaults to QUIET_MS", () => {
    expect(isReady(0, QUIET_MS)).toBe(true);
    expect(isReady(0, QUIET_MS - 1)).toBe(false);
  });
});

// the native folder-picker result parsers (macOS / Windows / Linux) — pure; the spawn
// is the untested wrapper. Each platform reports OK / cancel / error differently.
import { describe, it, expect } from "vitest";
import { parseMacResult, parseWinResult, parseLinuxResult } from "../../src/server/pick-folder.js";

describe("parseMacResult (osascript)", () => {
  it("OK → path, trailing slash stripped", () => {
    expect(parseMacResult(0, "/Users/me/proj/\n", "")).toEqual({ path: "/Users/me/proj" });
  });
  it("user cancel (-128) → cancelled", () => {
    expect(parseMacResult(1, "", "execution error: User canceled. (-128)")).toEqual({ cancelled: true });
  });
  it("empty OK → cancelled; other error → error", () => {
    expect(parseMacResult(0, "  \n", "")).toEqual({ cancelled: true });
    expect(parseMacResult(1, "", "boom")).toEqual({ error: "boom" });
  });
});

describe("parseWinResult (PowerShell FolderBrowserDialog)", () => {
  it("OK → the SelectedPath on stdout", () => {
    expect(parseWinResult(0, "C:\\Users\\me\\proj", "")).toEqual({ path: "C:\\Users\\me\\proj" });
  });
  it("cancel → empty stdout, exit 0 → cancelled", () => {
    expect(parseWinResult(0, "", "")).toEqual({ cancelled: true });
  });
  it("non-zero → error", () => {
    expect(parseWinResult(1, "", "Add-Type failed")).toEqual({ error: "Add-Type failed" });
  });
});

describe("parseLinuxResult (zenity/kdialog)", () => {
  it("OK → path (exit 0)", () => {
    expect(parseLinuxResult(0, "/home/me/proj\n", "")).toEqual({ path: "/home/me/proj" });
  });
  it("cancel → exit 1 → cancelled", () => {
    expect(parseLinuxResult(1, "", "")).toEqual({ cancelled: true });
  });
  it("other non-zero → error", () => {
    expect(parseLinuxResult(2, "", "no display")).toEqual({ error: "no display" });
  });
});

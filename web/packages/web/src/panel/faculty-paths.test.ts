// Pure tests for the right panel's path derivation + badge/parse helpers.
import { describe, expect, it } from "vitest";
import {
  actionRunbookPath, badgeLabel, facultyItemPath, facultyItemsDir,
  facultyReadmePath, parseGuardrailRules,
} from "./faculty-paths";

describe("faculty path derivation", () => {
  it("derives knowledge item and memory entry files (one-fact .md)", () => {
    expect(facultyItemPath("knowledge", "file-commands-hook-mjs"))
      .toBe(".zuzuu/knowledge/items/file-commands-hook-mjs.md");
    expect(facultyItemPath("memory", "20260612-session"))
      .toBe(".zuzuu/memory/entries/20260612-session.md");
  });

  it("passes through ids that are already filenames", () => {
    expect(facultyItemPath("knowledge", "note.txt")).toBe(".zuzuu/knowledge/items/note.txt");
    expect(facultyItemPath("memory", "entry.md")).toBe(".zuzuu/memory/entries/entry.md");
  });

  it("has no item dir for the heterogeneous faculties", () => {
    expect(facultyItemsDir("actions")).toBeNull();
    expect(facultyItemsDir("instructions")).toBeNull();
    expect(facultyItemsDir("guardrails")).toBeNull();
    expect(facultyItemPath("guardrails", "x")).toBeNull();
  });

  it("derives faculty READMEs and runbook definitions", () => {
    expect(facultyReadmePath("actions")).toBe(".zuzuu/actions/README.md");
    expect(actionRunbookPath("run-tests")).toBe(".zuzuu/actions/run-tests/action.json");
  });
});

describe("badgeLabel", () => {
  it("hides at zero/undefined", () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(undefined)).toBeNull();
  });
  it("shows the count, capped at 99+", () => {
    expect(badgeLabel(3)).toBe("3");
    expect(badgeLabel(99)).toBe("99");
    expect(badgeLabel(150)).toBe("99+");
  });
});

describe("parseGuardrailRules", () => {
  it("parses the real rules.json shape", () => {
    const text = JSON.stringify({
      version: 1,
      rules: [
        { id: "no-root-wipe", action: "deny", tool: "Bash", pattern: "rm\\s+-rf\\s+/", reason: "destructive delete" },
        { id: "confirm-force-push", action: "ask", tool: "Bash", pattern: "--force", reason: "rewrites history" },
      ],
    });
    const rules = parseGuardrailRules(text);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({
      id: "no-root-wipe", action: "deny", tool: "Bash", pattern: "rm\\s+-rf\\s+/", reason: "destructive delete",
    });
  });

  it("fills defaults for sparse rules and skips non-object entries", () => {
    const rules = parseGuardrailRules(JSON.stringify({ rules: [{ id: "r1" }, "junk", null] }));
    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({ id: "r1", action: "?", tool: "*", pattern: "", reason: "" });
  });

  it("returns [] on corrupt JSON or unexpected shapes", () => {
    expect(parseGuardrailRules("not json {")).toEqual([]);
    expect(parseGuardrailRules(JSON.stringify({ version: 1 }))).toEqual([]);
    expect(parseGuardrailRules(JSON.stringify({ rules: "nope" }))).toEqual([]);
    expect(parseGuardrailRules(JSON.stringify(null))).toEqual([]);
  });
});

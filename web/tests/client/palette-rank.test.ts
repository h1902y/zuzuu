// U3 — the ⌘K Notes (content) group. Proves: no group until the user types; a single
// loading placeholder (non-selecting) while the fan-out is in flight; an always-present
// "Create a note named X" sentinel when nothing matches (so cmdk never shows its global
// empty for a note query); a cap of 3 hits with a "see all results" tail beyond that; and
// that every value is query-prefixed so cmdk's subsequence filter keeps the rows.
import { describe, it, expect } from "vitest";
import type { ModuleItem } from "#shared/index.js";
import { notesGroup, NOTES_CAP, NOTES_HEADING } from "../../src/client/palette/palette-rank.js";

const item = (module: string, id: string, title: string, body = ""): ModuleItem =>
  ({ module, id, title, body, kind: "note" }) as ModuleItem;

describe("notesGroup — the ⌘K Notes content group", () => {
  it("returns null for a blank query (no group until typing)", () => {
    expect(notesGroup("", [item("knowledge", "a", "Auth")], false)).toBeNull();
    expect(notesGroup("   ", [item("knowledge", "a", "Auth")], false)).toBeNull();
  });

  it("shows a single non-selecting loading placeholder while the fan-out is in flight", () => {
    const g = notesGroup("auth", [], true)!;
    expect(g.heading).toBe(NOTES_HEADING);
    expect(g.commands).toHaveLength(1);
    expect(g.commands[0]!.action).toEqual({ kind: "noop" });
    expect(g.commands[0]!.label.toLowerCase()).toContain("searching");
  });

  it("yields a create-note sentinel when nothing matches", () => {
    const g = notesGroup("zzz", [item("knowledge", "a", "Auth flow")], false)!;
    expect(g.commands).toHaveLength(1);
    expect(g.commands[0]!.action).toEqual({ kind: "create-note", query: "zzz" });
    expect(g.commands[0]!.label).toContain("zzz");
  });

  it("maps up to 3 hits to open-note commands with no see-all tail", () => {
    const notes = [item("knowledge", "a", "Auth basics"), item("knowledge", "b", "Auth tokens")];
    const g = notesGroup("auth", notes, false)!;
    expect(g.commands).toHaveLength(2);
    expect(g.commands.every((c) => c.action.kind === "open-note")).toBe(true);
    expect(g.commands[0]!.action).toMatchObject({ kind: "open-note", module: "knowledge" });
  });

  it("caps at 3 hits and appends a see-all-search tail when there are more", () => {
    const notes = Array.from({ length: 5 }, (_, i) => item("knowledge", `n${i}`, `Auth note ${i}`));
    const g = notesGroup("auth", notes, false)!;
    expect(g.commands).toHaveLength(NOTES_CAP + 1);
    const opens = g.commands.filter((c) => c.action.kind === "open-note");
    expect(opens).toHaveLength(NOTES_CAP);
    expect(g.commands.at(-1)!.action).toEqual({ kind: "see-all-search", query: "auth" });
  });

  it("query-prefixes every value so cmdk's subsequence filter keeps the rows", () => {
    const notes = Array.from({ length: 4 }, (_, i) => item("knowledge", `n${i}`, `Auth ${i}`));
    const g = notesGroup("auth", notes, false)!;
    expect(g.commands.every((c) => c.value.startsWith("auth"))).toBe(true);
    expect(new Set(g.commands.map((c) => c.value)).size).toBe(g.commands.length); // distinct
  });
});

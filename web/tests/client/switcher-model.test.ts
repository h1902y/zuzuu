// U7 — the switcher model: picker rows, the in-place switch descriptor, and the
// open-folder autocomplete reducer (pure; the .tsx only dispatches).
import { describe, it, expect } from "vitest";
import {
  pickerRows, switchAction, openFolderReducer, initialOpenFolder,
} from "../../src/client/shell/switcher-model.js";
import type { RecentProject } from "#shared/index.js";

const r = (path: string, current = false): RecentProject => ({ path, name: path.split("/").pop()!, current });

describe("pickerRows", () => {
  it("puts the current Project first, preserves recency order for the rest", () => {
    const rows = pickerRows([r("/a"), r("/b", true), r("/c")]);
    expect(rows.map((x) => x.path)).toEqual(["/b", "/a", "/c"]);
    expect(rows[0]!.current).toBe(true);
  });
});

describe("switchAction", () => {
  it("yields an in-place switch descriptor for a row", () => {
    expect(switchAction({ path: "/b", name: "b", current: false })).toEqual({ kind: "switch", path: "/b" });
  });
});

describe("openFolderReducer", () => {
  it("typing updates the prefix and resets the highlight", () => {
    const s = openFolderReducer({ ...initialOpenFolder, highlighted: 2 }, { type: "setPrefix", prefix: "~/Doc" });
    expect(s.prefix).toBe("~/Doc");
    expect(s.highlighted).toBe(0);
  });
  it("↓ moves the highlight, wrapping", () => {
    let s = { prefix: "~/", dirs: ["a", "b"], highlighted: 0 };
    s = openFolderReducer(s, { type: "moveHighlight", delta: 1 });
    expect(s.highlighted).toBe(1);
    s = openFolderReducer(s, { type: "moveHighlight", delta: 1 });
    expect(s.highlighted).toBe(0); // wraps
  });
  it("⏎ applies the highlighted dir to the prefix", () => {
    const s = openFolderReducer({ prefix: "~/Doc", dirs: ["Documents", "Downloads"], highlighted: 0 }, { type: "applyHighlighted" });
    expect(s.prefix).toBe("~/Documents/");
    expect(s.dirs).toEqual([]);
  });
  it("⏎ with no suggestions is a no-op", () => {
    const before = { prefix: "~/zzz", dirs: [], highlighted: 0 };
    expect(openFolderReducer(before, { type: "applyHighlighted" })).toEqual(before);
  });
});

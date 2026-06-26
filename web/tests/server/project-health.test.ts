// P1.1 — the cross-project health reader (reads a .zuzuu from disk, no daemon).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, realpathSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readProjectHealth } from "../../src/server/project-health.js";
import { fixtureHome } from "./zuzuu-fixtures.js";

let root: string;
beforeEach(() => { root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-"))); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("readProjectHealth", () => {
  it("reads modules/notes/pending/guarded from a real .zuzuu", () => {
    fixtureHome(root); // 5 modules (each module.md), knowledge has 1 item + 1 staged
    const h = readProjectHealth(root);
    expect(h.modules).toBe(5);
    expect(h.guarded).toBe(true);
    expect(h.notes).toBe(1);
    expect(h.pending).toBe(1);
    expect(h.lastActivityMs).toBeGreaterThan(0);
  });

  it("a folder with no .zuzuu → all zeros, never throws", () => {
    expect(readProjectHealth(root)).toEqual({ modules: 0, notes: 0, pending: 0, guarded: false, lastActivityMs: 0 });
  });

  it("ignores dirs without a module.md (not real modules)", () => {
    mkdirSync(path.join(root, ".zuzuu", "scratch"), { recursive: true });
    writeFileSync(path.join(root, ".zuzuu", "scratch", "note.md"), "x");
    expect(readProjectHealth(root).modules).toBe(0);
  });
});

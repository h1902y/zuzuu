// U5 — the directory-autocomplete guard (the one out-of-jail surface). Pure
// splitPrefix coverage + listDirs against a real tmpdir tree, asserting names-only,
// dirs-only, error→empty, and the cap.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, realpathSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { splitPrefix, listDirs } from "../../src/server/dir-complete.js";

let root: string;
beforeEach(() => { root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-"))); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("splitPrefix — base dir + partial", () => {
  it("expands ~ and splits off the partial", () => {
    expect(splitPrefix("~/Doc")).toEqual({ baseDir: homedir(), partial: "Doc" });
  });
  it("a trailing slash lists the dir with an empty partial", () => {
    expect(splitPrefix("/a/b/")).toEqual({ baseDir: "/a/b", partial: "" });
  });
  it("a plain path splits into dirname + basename", () => {
    expect(splitPrefix("/a/b/car")).toEqual({ baseDir: "/a/b", partial: "car" });
  });
  it("empty prefix → home, empty partial", () => {
    expect(splitPrefix("")).toEqual({ baseDir: homedir(), partial: "" });
  });
});

describe("listDirs — names only, guarded", () => {
  it("returns child directory names, excludes files", async () => {
    mkdirSync(path.join(root, "alpha"));
    mkdirSync(path.join(root, "beta"));
    writeFileSync(path.join(root, "afile.txt"), "x");
    const { dirs } = await listDirs(root + path.sep);
    expect(dirs).toEqual(["alpha", "beta"]);
    expect(dirs).not.toContain("afile.txt");
  });
  it("filters by the partial", async () => {
    mkdirSync(path.join(root, "cards-game"));
    mkdirSync(path.join(root, "canvas"));
    mkdirSync(path.join(root, "other"));
    const { dirs } = await listDirs(path.join(root, "ca"));
    expect(dirs).toEqual(["canvas", "cards-game"]);
  });
  it("a non-existent prefix → empty list, never throws", async () => {
    await expect(listDirs(path.join(root, "nope", "deeper", "x"))).resolves.toEqual({
      prefix: path.join(root, "nope", "deeper", "x"),
      dirs: [],
    });
  });
  it("caps the result count", async () => {
    for (let i = 0; i < 60; i++) mkdirSync(path.join(root, `d${String(i).padStart(2, "0")}`));
    const { dirs } = await listDirs(root + path.sep);
    expect(dirs.length).toBe(50);
  });
});

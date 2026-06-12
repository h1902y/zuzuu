// Pure logic tests for the vault picker + status-bar vault menu (no DOM needed).
import { describe, expect, it } from "vitest";
import { breadcrumbs, capRecents, menuSubdirs, parentDir, tilde } from "./vault-picker-logic";

describe("breadcrumbs", () => {
  it("collapses a macOS home prefix to a single ~ crumb", () => {
    expect(breadcrumbs("/Users/hkc/Documents/zuzuu")).toEqual([
      { label: "~", path: "/Users/hkc" },
      { label: "Documents", path: "/Users/hkc/Documents" },
      { label: "zuzuu", path: "/Users/hkc/Documents/zuzuu" },
    ]);
  });

  it("collapses a Linux home prefix", () => {
    expect(breadcrumbs("/home/hkc/code")).toEqual([
      { label: "~", path: "/home/hkc" },
      { label: "code", path: "/home/hkc/code" },
    ]);
  });

  it("is a single ~ crumb at the home dir itself", () => {
    expect(breadcrumbs("/Users/hkc")).toEqual([{ label: "~", path: "/Users/hkc" }]);
  });

  it("starts at / for paths outside a home dir", () => {
    expect(breadcrumbs("/opt/data")).toEqual([
      { label: "/", path: "/" },
      { label: "opt", path: "/opt" },
      { label: "data", path: "/opt/data" },
    ]);
  });

  it("does not treat /Users itself as a home dir", () => {
    expect(breadcrumbs("/Users")).toEqual([
      { label: "/", path: "/" },
      { label: "Users", path: "/Users" },
    ]);
  });

  it("handles the fs root and rejects relative paths", () => {
    expect(breadcrumbs("/")).toEqual([{ label: "/", path: "/" }]);
    expect(breadcrumbs("not/absolute")).toEqual([]);
    expect(breadcrumbs("")).toEqual([]);
  });
});

describe("parentDir", () => {
  it("returns the parent of a nested dir", () => {
    expect(parentDir("/Users/hkc/Documents")).toBe("/Users/hkc");
  });

  it("returns / for a first-level dir", () => {
    expect(parentDir("/opt")).toBe("/");
  });

  it("returns null at the fs root and for relative paths", () => {
    expect(parentDir("/")).toBeNull();
    expect(parentDir("relative")).toBeNull();
    expect(parentDir("")).toBeNull();
  });

  it("ignores trailing slashes", () => {
    expect(parentDir("/a/b/")).toBe("/a");
  });
});

describe("capRecents", () => {
  const recent = ["/a", "/b", "/c", "/d", "/e", "/f", "/g"];

  it("caps at 5 by default", () => {
    expect(capRecents(recent, undefined)).toEqual(["/a", "/b", "/c", "/d", "/e"]);
  });

  it("drops the current root before capping", () => {
    expect(capRecents(recent, "/b")).toEqual(["/a", "/c", "/d", "/e", "/f"]);
  });

  it("dedupes while keeping first occurrence order", () => {
    expect(capRecents(["/x", "/y", "/x", "/z"], undefined)).toEqual(["/x", "/y", "/z"]);
  });

  it("skips empty entries and respects a custom cap", () => {
    expect(capRecents(["", "/a", "/b"], undefined, 1)).toEqual(["/a"]);
  });
});

describe("menuSubdirs", () => {
  const entries = [
    { name: "src", kind: "dir" },
    { name: "readme.md", kind: "file" },
    { name: "linked", kind: "symlink", targetKind: "dir" },
    { name: "broken", kind: "symlink", targetKind: "file" },
  ];

  it("keeps real dirs and dir-targeting symlinks only", () => {
    expect(menuSubdirs(entries)).toEqual(["src", "linked"]);
  });

  it("caps at the given maximum", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `d${i}`, kind: "dir" }));
    expect(menuSubdirs(many, 8)).toHaveLength(8);
  });
});

describe("tilde", () => {
  it("collapses home prefixes for display", () => {
    expect(tilde("/Users/hkc/Documents")).toBe("~/Documents");
    expect(tilde("/home/hkc")).toBe("~");
    expect(tilde("/opt/data")).toBe("/opt/data");
  });
});

it("menuSubdirs lists visible dirs before dot-dirs", () => {
  const rows = [".git", ".zuzuu", "docs", "web", "bin"].map((name) => ({ name, kind: "dir" }));
  expect(menuSubdirs(rows, 4)).toEqual(["docs", "web", "bin", ".git"]);
});

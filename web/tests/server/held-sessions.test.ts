// U6 — the held-session read + the merge/discard argv. Pure parsing/shaping/argv
// (branch → id + kind, the verb per kind) and the one CLI read (a stub `zz session
// status --json` → its `held[]`, id-enriched).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, chmodSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import type { HeldSession } from "#shared/index.js";
import {
  parseHeldBranch,
  shapeHeld,
  readHeld,
  mergeArgs,
  discardArgs,
  parseWorktrees,
  worktreeRelPath,
} from "../../src/server/held-sessions.js";

describe("parseHeldBranch — derive id + kind from the held branch namespace", () => {
  it("zz/session-<id> → worktree; zz/held-<id> → in-place", () => {
    expect(parseHeldBranch("zz/session-abc123")).toEqual({ id: "abc123", kind: "worktree" });
    expect(parseHeldBranch("zz/held-abc123")).toEqual({ id: "abc123", kind: "inplace" });
  });
  it("an unrecognized / empty / non-string branch → null", () => {
    expect(parseHeldBranch("main")).toBeNull();
    expect(parseHeldBranch("zz/session-")).toBeNull();
    expect(parseHeldBranch(undefined)).toBeNull();
    expect(parseHeldBranch(42)).toBeNull();
  });
});

describe("shapeHeld — one raw status entry → the HeldSession DTO", () => {
  it("carries the summary + mergeability, deriving id + kind", () => {
    expect(shapeHeld({ branch: "zz/session-x", checkpoints: 2, files: 3, added: 9, removed: 4, mergeability: "ready" }))
      .toEqual({ id: "x", branch: "zz/session-x", kind: "worktree", checkpoints: 2, files: 3, added: 9, removed: 4, mergeability: "ready" });
  });
  it("coerces missing/odd counts to 0 and an unknown mergeability to 'unknown'", () => {
    expect(shapeHeld({ branch: "zz/held-y" }))
      .toEqual({ id: "y", branch: "zz/held-y", kind: "inplace", checkpoints: 0, files: 0, added: 0, removed: 0, mergeability: "unknown" });
    expect(shapeHeld({ branch: "zz/session-z", mergeability: "weird" })?.mergeability).toBe("unknown");
  });
  it("drops an entry with a missing / unparseable branch", () => {
    expect(shapeHeld({ checkpoints: 1 })).toBeNull();
    expect(shapeHeld({ branch: "feature/x" })).toBeNull();
    expect(shapeHeld(null)).toBeNull();
  });
});

describe("mergeArgs / discardArgs — the verb per kind", () => {
  const wt: HeldSession = { id: "abc", branch: "zz/session-abc", kind: "worktree", checkpoints: 1, files: 1, added: 1, removed: 0, mergeability: "ready" };
  const ip: HeldSession = { ...wt, id: "def", branch: "zz/held-def", kind: "inplace" };
  it("worktree → worktree close / worktree discard --yes", () => {
    expect(mergeArgs(wt)).toEqual(["session", "worktree", "close", "abc"]);
    expect(discardArgs(wt)).toEqual(["session", "worktree", "discard", "abc", "--yes"]);
  });
  it("in-place → session merge / session discard --yes", () => {
    expect(mergeArgs(ip)).toEqual(["session", "merge"]);
    expect(discardArgs(ip)).toEqual(["session", "discard", "--yes"]);
  });
});

describe("readHeld — shells `zz session status --json` and id-enriches its held[]", () => {
  let root: string;
  beforeEach(() => { root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-held-"))); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function statusStub(r: string, json: string): string {
    const stub = path.join(r, "zuzuu-status.sh");
    writeFileSync(stub, `#!/bin/sh\necho '${json}'\n`);
    chmodSync(stub, 0o755);
    return stub;
  }

  it("returns the shaped held sessions; unparseable branches are dropped", async () => {
    const stub = statusStub(root, JSON.stringify({
      enabled: true, main: "main", active: null, onSessionBranch: false,
      held: [
        { branch: "zz/session-a", checkpoints: 2, files: 3, added: 8, removed: 1, mergeability: "ready" },
        { branch: "zz/held-b", checkpoints: 1, files: 0, added: 0, removed: 0, mergeability: "conflict" },
        { branch: "garbage" }, // dropped
      ],
    }));
    const held = await readHeld(root, stub);
    expect(held).toEqual([
      { id: "a", branch: "zz/session-a", kind: "worktree", checkpoints: 2, files: 3, added: 8, removed: 1, mergeability: "ready" },
      { id: "b", branch: "zz/held-b", kind: "inplace", checkpoints: 1, files: 0, added: 0, removed: 0, mergeability: "conflict" },
    ]);
  });

  it("CLI absent → [] (degrades to 'nothing held', never throws)", async () => {
    expect(await readHeld(root, "definitely-not-a-real-binary-zzz")).toEqual([]);
  });

  it("no held key → []", async () => {
    const stub = statusStub(root, JSON.stringify({ enabled: true }));
    expect(await readHeld(root, stub)).toEqual([]);
  });

  // U8: a worktree-held session is enriched with its (workspace-relative) worktree
  // path so the conflict→Resolve flow can open a shell there (round-trips safeJoin).
  function gitRepoWithWorktree(r: string): { branch: string; rel: string } {
    const g = (...a: string[]) => execFileSync("git", ["-C", r, ...a], { stdio: "pipe" });
    g("init", "-q");
    g("config", "user.email", "t@t");
    g("config", "user.name", "t");
    writeFileSync(path.join(r, "f.txt"), "hi\n");
    g("add", "-A");
    g("commit", "-qm", "init");
    const branch = "zz/session-abc123";
    g("worktree", "add", "-q", "-b", branch, path.join(r, ".zuzuu", "worktrees", "abc123"));
    return { branch, rel: ".zuzuu/worktrees/abc123" };
  }

  it("enriches a worktree-held session with its workspace-relative worktreePath", async () => {
    const { branch } = gitRepoWithWorktree(root);
    const stub = statusStub(root, JSON.stringify({
      held: [{ branch, checkpoints: 1, files: 1, added: 1, removed: 0, mergeability: "conflict" }],
    }));
    const held = await readHeld(root, stub);
    expect(held).toHaveLength(1);
    expect(held[0]?.worktreePath).toBe(".zuzuu/worktrees/abc123");
  });

  it("an in-place hold gets no worktreePath (no worktree backs it)", async () => {
    gitRepoWithWorktree(root); // a worktree exists, but the held branch is in-place
    const stub = statusStub(root, JSON.stringify({
      held: [{ branch: "zz/held-xyz", checkpoints: 1, files: 1, added: 0, removed: 0, mergeability: "conflict" }],
    }));
    const held = await readHeld(root, stub);
    expect(held).toHaveLength(1);
    expect(held[0]?.kind).toBe("inplace");
    expect(held[0]?.worktreePath).toBeUndefined();
  });

  it("a non-git workspace degrades — worktree entry kept, no worktreePath", async () => {
    const stub = statusStub(root, JSON.stringify({
      held: [{ branch: "zz/session-q", checkpoints: 1, files: 1, added: 1, removed: 0, mergeability: "ready" }],
    }));
    const held = await readHeld(root, stub); // root is not a git repo
    expect(held).toHaveLength(1);
    expect(held[0]?.worktreePath).toBeUndefined();
  });
});

describe("parseWorktrees — porcelain → { path, branch }[]", () => {
  it("pairs each worktree with its branch (refs/heads stripped)", () => {
    const out = [
      "worktree /repo",
      "HEAD aaaa",
      "branch refs/heads/main",
      "",
      "worktree /repo/.zuzuu/worktrees/abc",
      "HEAD bbbb",
      "branch refs/heads/zz/session-abc",
      "",
    ].join("\n");
    expect(parseWorktrees(out)).toEqual([
      { path: "/repo", branch: "main" },
      { path: "/repo/.zuzuu/worktrees/abc", branch: "zz/session-abc" },
    ]);
  });
  it("a detached worktree (no branch line) → empty branch", () => {
    expect(parseWorktrees("worktree /repo/wt\nHEAD cccc\ndetached\n")).toEqual([{ path: "/repo/wt", branch: "" }]);
  });
});

describe("worktreeRelPath — branch → workspace-relative worktree dir", () => {
  const root = "/repo";
  const worktrees = [
    { path: "/repo", branch: "main" },
    { path: "/repo/.zuzuu/worktrees/abc", branch: "zz/session-abc" },
  ];
  it("returns the forward-slashed relative path for a matched in-root worktree", () => {
    expect(worktreeRelPath("zz/session-abc", worktrees, root)).toBe(".zuzuu/worktrees/abc");
  });
  it("undefined when no worktree holds the branch", () => {
    expect(worktreeRelPath("zz/session-nope", worktrees, root)).toBeUndefined();
  });
  it("undefined when the worktree lies outside root (can't safely open a shell there)", () => {
    expect(worktreeRelPath("x", [{ path: "/elsewhere/wt", branch: "x" }], root)).toBeUndefined();
  });
});

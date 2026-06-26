// U5/KTD5 — agent-close runs `zz observe` after a successful merge, then rides the
// post-close pending count on the close result (so the close card reads a deterministic
// count). The CLI shell is a stub binary (logs its calls); the pending count is injected
// so the test needs no real `.zuzuu`. Covers: observe runs after merge · pending surfaces
// · observe runs after a worktree close · observe is NOT run when the merge fails / CLI is
// absent · an observe failure never poisons the merge result.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync, existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAgentCloser } from "../../src/server/agent-close.js";
import type { Session } from "../../src/server/session.js";

let root: string;
beforeEach(() => { root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-close-"))); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** A minimal Session stand-in: close() reads only id / cwd / usesWorktree. */
function fakeSession(over: Partial<Pick<Session, "id" | "cwd" | "usesWorktree">> = {}): Session {
  return { id: "agent1", cwd: root, usesWorktree: false, ...over } as Session;
}

/** A stub `zuzuu` that logs every call and answers per the argv:
 *  - `session merge` / `session worktree close` → a merge JSON
 *  - `observe` → ok JSON
 *  - `worktree open` (probe) → not-a-git (so the in-place path is used)
 *  When `mergeFails`, the merge call exits 1. */
function cliStub(r: string, opts: { mergeFails?: boolean } = {}): { binary: string; marker: string } {
  const marker = path.join(r, "calls.log");
  const stub = path.join(r, "zuzuu-stub.sh");
  const mergeBody = opts.mergeFails
    ? `echo 'merge kaboom' >&2; exit 1`
    : `echo '{"ok":true,"mergedAs":"abc12345","mergedTo":"main","commits":1}'`;
  writeFileSync(
    stub,
    `#!/bin/sh
echo "$*" >> '${marker}'
case "$*" in
  *"worktree open"*) echo '{"ok":false,"reason":"not-a-git-repo"}'; exit 1 ;;
  *"worktree close"*) echo '{"ok":true,"mergedAs":"deadbeef","mergedTo":"main","commits":1}' ;;
  *"session merge"*) ${mergeBody} ;;
  *"observe"*) echo '{"ok":true,"proposed":2}' ;;
  *) echo '{}' ;;
esac
`,
  );
  chmodSync(stub, 0o755);
  return { binary: stub, marker };
}

const calls = (marker: string): string[] => (existsSync(marker) ? readFileSync(marker, "utf8").trim().split("\n") : []);

describe("agent-close runs observe after a successful merge (U5/KTD5)", () => {
  it("in-place merge → observe runs, then the post-close pending count rides the result", async () => {
    const { binary, marker } = cliStub(root);
    const closer = createAgentCloser(() => root, { binary, pendingCount: () => 2 });
    const result = await closer.close(fakeSession());

    expect(result).toEqual({
      ok: true,
      merge: { ok: true, mergedAs: "abc12345", mergedTo: "main", commits: 1 },
      pending: 2,
    });
    const log = calls(marker);
    // the merge ran, THEN observe ran (ordering matters — staging must precede the read)
    const mergeIdx = log.findIndex((c) => c.includes("session merge"));
    const observeIdx = log.findIndex((c) => /(^|\s)observe(\s|$)/.test(c));
    expect(mergeIdx).toBeGreaterThanOrEqual(0);
    expect(observeIdx).toBeGreaterThan(mergeIdx);
  });

  it("worktree close → observe also runs and the count surfaces", async () => {
    const { binary, marker } = cliStub(root);
    const closer = createAgentCloser(() => root, { binary, pendingCount: () => 5 });
    const result = await closer.close(fakeSession({ usesWorktree: true }));

    expect(result).toEqual({
      ok: true,
      merge: { ok: true, mergedAs: "deadbeef", mergedTo: "main", commits: 1 },
      pending: 5,
    });
    expect(calls(marker).some((c) => /(^|\s)observe(\s|$)/.test(c))).toBe(true);
  });

  it("pending = 0 still rides (the detector reads it → no card)", async () => {
    const { binary } = cliStub(root);
    const closer = createAgentCloser(() => root, { binary, pendingCount: () => 0 });
    const result = await closer.close(fakeSession());
    expect(result).toEqual({
      ok: true,
      merge: { ok: true, mergedAs: "abc12345", mergedTo: "main", commits: 1 },
      pending: 0,
    });
  });

  it("a FAILED merge → observe is NOT run, no pending count (nothing was staged)", async () => {
    const { binary, marker } = cliStub(root, { mergeFails: true });
    const closer = createAgentCloser(() => root, { binary, pendingCount: () => 9 });
    const result = await closer.close(fakeSession());

    expect(result).toMatchObject({ ok: false });
    expect("pending" in (result as object)).toBe(false);
    expect(calls(marker).some((c) => /(^|\s)observe(\s|$)/.test(c))).toBe(false);
  });

  it("absent CLI → cliAbsent, observe never attempted", async () => {
    const closer = createAgentCloser(() => root, { binary: "definitely-not-a-real-binary-zzz", pendingCount: () => 3 });
    const result = await closer.close(fakeSession());
    expect(result).toEqual({ cliAbsent: true });
  });

  it("an observe FAILURE never poisons the merge result (best-effort)", async () => {
    // observe exits non-zero, but the merge already succeeded → the user keeps the merge.
    const marker = path.join(root, "calls.log");
    const stub = path.join(root, "zuzuu-stub.sh");
    writeFileSync(
      stub,
      `#!/bin/sh
echo "$*" >> '${marker}'
case "$*" in
  *"worktree open"*) echo '{"ok":false}'; exit 1 ;;
  *"session merge"*) echo '{"ok":true,"mergedAs":"abc12345","mergedTo":"main","commits":1}' ;;
  *"observe"*) echo 'observe blew up' >&2; exit 1 ;;
  *) echo '{}' ;;
esac
`,
    );
    chmodSync(stub, 0o755);
    const closer = createAgentCloser(() => root, { binary: stub, pendingCount: () => 1 });
    const result = await closer.close(fakeSession());
    expect(result).toMatchObject({ ok: true, pending: 1 });
  });
});

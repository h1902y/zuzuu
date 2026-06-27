// U3 — agent-close FINALIZES (holds) the session on PTY exit (never auto-merges):
// it shells `zz session worktree finalize <id>`, then runs `zz observe` and rides the
// post-close pending count on the held result (so the close card reads a deterministic
// count). The CLI shell is a stub binary (logs its calls); the pending count is injected
// so the test needs no real `.zuzuu`. Covers: finalize holds (never merges) · observe
// runs after the hold · pending surfaces · observe is NOT run when finalize fails / the
// CLI is absent · an observe failure never poisons the held result.
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
 *  - `session worktree finalize` → a HELD JSON (the U3 hold; never a merge)
 *  - `observe` → ok JSON
 *  When `finalizeFails`, the finalize call exits 1. */
function cliStub(r: string, opts: { finalizeFails?: boolean } = {}): { binary: string; marker: string } {
  const marker = path.join(r, "calls.log");
  const stub = path.join(r, "zuzuu-stub.sh");
  const finalizeBody = opts.finalizeFails
    ? `echo 'finalize kaboom' >&2; exit 1`
    : `echo '{"ok":true,"held":"zz/session-agent1","worktree":"/tmp/wt","checkpoints":1}'`;
  writeFileSync(
    stub,
    `#!/bin/sh
echo "$*" >> '${marker}'
case "$*" in
  *"worktree finalize"*) ${finalizeBody} ;;
  *"observe"*) echo '{"ok":true,"proposed":2}' ;;
  *) echo '{}' ;;
esac
`,
  );
  chmodSync(stub, 0o755);
  return { binary: stub, marker };
}

const calls = (marker: string): string[] => (existsSync(marker) ? readFileSync(marker, "utf8").trim().split("\n") : []);

describe("agent-close finalizes (holds) then observes (U3 + U5/KTD5)", () => {
  it("finalize HOLDS the branch (never merges), observe runs, the pending count rides the held result", async () => {
    const { binary, marker } = cliStub(root);
    const closer = createAgentCloser(() => root, { binary, pendingCount: () => 2 });
    const result = await closer.close(fakeSession());

    expect(result).toEqual({ ok: true, held: true, branch: "zz/session-agent1", pending: 2 });
    const log = calls(marker);
    // the hold ran, THEN observe ran (ordering matters — staging must precede the read)
    const finalizeIdx = log.findIndex((c) => c.includes("worktree finalize"));
    const observeIdx = log.findIndex((c) => /(^|\s)observe(\s|$)/.test(c));
    expect(finalizeIdx).toBeGreaterThanOrEqual(0);
    expect(observeIdx).toBeGreaterThan(finalizeIdx);
    // NEVER a merge — END holds.
    expect(log.some((c) => /session merge|worktree close/.test(c))).toBe(false);
  });

  it("worktree-backed agent also finalizes (holds) and the count surfaces", async () => {
    const { binary, marker } = cliStub(root);
    const closer = createAgentCloser(() => root, { binary, pendingCount: () => 5 });
    const result = await closer.close(fakeSession({ usesWorktree: true }));

    expect(result).toEqual({ ok: true, held: true, branch: "zz/session-agent1", pending: 5 });
    expect(calls(marker).some((c) => /(^|\s)observe(\s|$)/.test(c))).toBe(true);
    expect(calls(marker).some((c) => c.includes("worktree finalize"))).toBe(true);
  });

  it("pending = 0 still rides (the detector reads it → no card)", async () => {
    const { binary } = cliStub(root);
    const closer = createAgentCloser(() => root, { binary, pendingCount: () => 0 });
    const result = await closer.close(fakeSession());
    expect(result).toEqual({ ok: true, held: true, branch: "zz/session-agent1", pending: 0 });
  });

  it("a FAILED finalize → observe is NOT run, no pending count (nothing was staged)", async () => {
    const { binary, marker } = cliStub(root, { finalizeFails: true });
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

  it("an observe FAILURE never poisons the held result (best-effort)", async () => {
    // observe exits non-zero, but the hold already succeeded → the user keeps the hold.
    const marker = path.join(root, "calls.log");
    const stub = path.join(root, "zuzuu-stub.sh");
    writeFileSync(
      stub,
      `#!/bin/sh
echo "$*" >> '${marker}'
case "$*" in
  *"worktree finalize"*) echo '{"ok":true,"held":"zz/session-agent1","checkpoints":1}' ;;
  *"observe"*) echo 'observe blew up' >&2; exit 1 ;;
  *) echo '{}' ;;
esac
`,
    );
    chmodSync(stub, 0o755);
    const closer = createAgentCloser(() => root, { binary: stub, pendingCount: () => 1 });
    const result = await closer.close(fakeSession());
    expect(result).toMatchObject({ ok: true, held: true, pending: 1 });
  });
});

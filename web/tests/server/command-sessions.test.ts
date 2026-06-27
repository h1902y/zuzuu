// Command sessions (W2.2 ②): POST /api/sessions can spawn a host CLI
// DIRECTLY on the PTY (argv, no shell, no rc injection), gated by a
// server-side allowlist; agent PTY exits trigger exactly one FINALIZE (hold) —
// `zuzuu session worktree finalize` (U3, never an auto-merge) — whose result is
// readable via GET /api/sessions/:id.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  chmodSync,
  realpathSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Session } from "../../src/server/session.js";
import { SessionManager } from "../../src/server/session-manager.js";
import { WebcodeServer, type ServerConfig } from "../../src/server/server.js";

let root: string;
// realpath the temp root: the daemon realpaths its root at startup; on macOS
// /var → /private/var would otherwise break path checks.
beforeEach(() => {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-cmd-")));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond: () => boolean | Promise<boolean>, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await sleep(50);
  }
}

/** All "o"-event payloads of the session's asciicast, concatenated. */
function castText(session: Session): string {
  return session
    .recording()
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => JSON.parse(l) as [number, string, string])
    .filter(([, code]) => code === "o")
    .map(([, , data]) => data)
    .join("");
}

function makeServer(extra: Partial<ServerConfig> = {}): WebcodeServer {
  return new WebcodeServer({
    root,
    port: 7770,
    host: "127.0.0.1",
    token: "test-token",
    webDist: root,
    version: "0.0.0-test",
    ...extra,
  });
}

/** Token → cookie exchange via the app itself (no listening socket needed). */
async function authedHeaders(server: WebcodeServer): Promise<Record<string, string>> {
  const res = await server.app.request("/auth?token=test-token", {
    headers: { host: "localhost" },
  });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("auth exchange did not set a cookie");
  return { host: "localhost", cookie: setCookie.split(";")[0]! };
}

const postJson = (server: WebcodeServer, headers: Record<string, string>, body: unknown) =>
  server.app.request("/api/sessions", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** A zuzuu stub for the in-place fallback path: the worktree-open probe reports a
 *  non-git workspace (→ daemon falls back to in-place), and the U3 `worktree
 *  finalize` (hold) + `observe` calls are logged. finalize answers with a HELD JSON
 *  (END never merges). */
function finalizeStub(r: string, payload = '{"ok":true,"held":"zz/session-x","checkpoints":2}') {
  const marker = path.join(r, "finalize-calls.log");
  const stub = path.join(r, "zuzuu-finalize-stub.sh");
  writeFileSync(
    stub,
    `#!/bin/sh
case "$*" in
  *"worktree open"*) echo '{"ok":false,"reason":"not-a-git-repo"}'; exit 1 ;;
  *) echo "run $@" >> '${marker}'; echo '${payload}' ;;
esac
`,
  );
  chmodSync(stub, 0o755);
  return { stub, marker };
}

/** A zuzuu stub for the worktree path: `worktree open` mkdir's a real dir and
 *  returns it; `worktree finalize` (the U3 hold) is logged + answered with held JSON. */
function worktreeStub(r: string) {
  const marker = path.join(r, "wt-calls.log");
  const wt = path.join(r, ".zuzuu", ".worktrees", "agent");
  const stub = path.join(r, "zuzuu-wt-stub.sh");
  writeFileSync(
    stub,
    `#!/bin/sh
case "$*" in
  *"worktree open"*)
    mkdir -p '${wt}'
    echo '{"ok":true,"branch":"zz/session-agent","worktree":"${wt}","base":"main"}'
    ;;
  *"worktree finalize"*)
    echo "run $@" >> '${marker}'
    echo '{"ok":true,"held":"zz/session-agent","worktree":"${wt}","checkpoints":1}'
    ;;
esac
`,
  );
  chmodSync(stub, 0o755);
  return { stub, marker, wt };
}

describe("Session: direct command spawn", () => {
  it("spawns the argv directly — no shell, so metacharacters stay literal", async () => {
    const manager = new SessionManager(root);
    const session = manager.create(undefined, 80, 24, {
      command: "/bin/echo",
      args: ["$HOME;", "literal-marker"],
      type: "agent",
      host: "claude",
    });
    expect(session.info().type).toBe("agent");
    expect(session.info().host).toBe("claude");
    expect(session.title).toBe("echo"); // basename of the command
    await waitFor(() => !session.alive);
    const text = castText(session);
    expect(text).toContain("literal-marker");
    expect(text).toContain("$HOME;"); // not expanded — argv was never shell-interpreted
    manager.shutdown();
  });

  it("command sessions get a plain env: no ZDOTDIR/rc injection, WEBCODE=1 kept", async () => {
    const manager = new SessionManager(root);
    const session = manager.create(undefined, 200, 24, { command: "/usr/bin/env", type: "agent" });
    await waitFor(() => !session.alive);
    const text = castText(session);
    expect(text).toContain("WEBCODE=1");
    expect(text).not.toContain("webcode-si-"); // the shell-integration temp dir marker
    manager.shutdown();
  });

  // U4 characterization: a freshly created session carries a random-hex id and
  // the current SessionInfo shape — and exposes NO trace linkage today (no
  // ptyId/traceId/branch fields on SessionInfo). The join is added on the host
  // side via the injected env key, not onto SessionInfo.
  it("characterization: a session has a 16-char hex id and the current SessionInfo shape (no trace linkage)", () => {
    const manager = new SessionManager(root);
    const session = manager.create(undefined, 80, 24, { command: "/bin/echo", type: "agent", host: "claude" });
    expect(session.id).toMatch(/^[0-9a-f]{16}$/);
    const info = session.info();
    expect(Object.keys(info).sort()).toEqual(
      ["alive", "createdAt", "cwd", "host", "id", "title", "type"].sort(),
    );
    // no session-linkage facets live on the daemon SessionInfo
    expect("traceId" in info).toBe(false);
    expect("branch" in info).toBe(false);
    manager.shutdown();
  });

  // U4: the daemon injects ZUZUU_PTY_ID (= the session id) into the agent launch
  // environment block — the explicit join key the host's SessionStart hook reads
  // to link the PTY runtime to the durable trace record (KTD2).
  it("injects ZUZUU_PTY_ID (= session id) into the agent launch environment", async () => {
    const manager = new SessionManager(root);
    const session = manager.create(undefined, 200, 24, { command: "/usr/bin/env", type: "agent", host: "claude" });
    await waitFor(() => !session.alive);
    const text = castText(session);
    expect(text).toContain(`ZUZUU_PTY_ID=${session.id}`);
    manager.shutdown();
  });

  it("defaults: no opts → a shell session, type 'shell', no host", () => {
    const manager = new SessionManager(root);
    const session = manager.create(undefined, 80, 24);
    const info = session.info();
    expect(info.type).toBe("shell");
    expect(info.host).toBeUndefined();
    manager.shutdown();
  });
});

describe("POST /api/sessions command allowlist", () => {
  it("rejects non-allowlisted commands with 400 (default fixed list)", async () => {
    const server = makeServer(); // default allowlist: claude/gemini/codex/pi/opencode/zuzuu
    const headers = await authedHeaders(server);
    for (const command of ["/bin/echo", "bash", "rm", "claude; rm -rf /", "../claude", ""]) {
      const res = await postJson(server, headers, { command });
      expect(res.status, `command ${JSON.stringify(command)} must be rejected`).toBe(400);
      expect((await res.json()).error).toBe("command not allowed");
    }
    server.stop();
  });

  it("rejects malformed args / type / host without spawning", async () => {
    const server = makeServer({ commandAllowlist: ["/bin/echo"] });
    const headers = await authedHeaders(server);
    expect((await postJson(server, headers, { command: "/bin/echo", args: "hi" })).status).toBe(400);
    expect((await postJson(server, headers, { command: "/bin/echo", args: [1] })).status).toBe(400);
    expect((await postJson(server, headers, { args: ["orphan"] })).status).toBe(400);
    expect((await postJson(server, headers, { type: "robot" })).status).toBe(400);
    expect((await postJson(server, headers, { command: "/bin/echo", host: 7 })).status).toBe(400);
    const list = await (await server.app.request("/api/sessions", { headers })).json();
    expect(list).toEqual([]); // nothing was spawned
    server.stop();
  });

  it("spawns an allowlisted command; type + host surface in the session list", async () => {
    const server = makeServer({ commandAllowlist: ["/bin/echo"] });
    const headers = await authedHeaders(server);
    const res = await postJson(server, headers, {
      command: "/bin/echo",
      args: ["hello"],
      type: "agent",
      host: "claude",
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({ type: "agent", host: "claude", title: "echo" });

    const list = await (await server.app.request("/api/sessions", { headers })).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: created.id, type: "agent", host: "claude" });
    server.stop();
  });

  it("plain shell create still works and reports type 'shell'", async () => {
    const server = makeServer();
    const headers = await authedHeaders(server);
    const res = await postJson(server, headers, {});
    expect(res.status).toBe(201);
    expect((await res.json()).type).toBe("shell");
    server.stop();
  });
});
describe("agent exit → session-git finalize (hold)", () => {
  it("agent PTY exit triggers EXACTLY ONE finalize (hold, NOT a merge); closeResult retrievable via GET /api/sessions/:id", async () => {
    const { stub, marker } = finalizeStub(root);
    const server = makeServer({ commandAllowlist: ["/bin/echo"], zuzuuBinary: stub });
    const headers = await authedHeaders(server);
    const created = await (
      await postJson(server, headers, { command: "/bin/echo", args: ["done"], type: "agent", host: "claude" })
    ).json();

    let detail: Record<string, unknown> = {};
    await waitFor(async () => {
      const res = await server.app.request(`/api/sessions/${created.id}`, { headers });
      expect(res.status).toBe(200);
      detail = await res.json();
      return detail.closeResult !== undefined;
    });
    expect(detail.alive).toBe(false);
    // U3: END holds (the `held` variant) — NO merge. U5/KTD5: `pending` is the post-close
    // staged count off the (empty temp) `.zuzuu` after the close-time `zz observe` ran.
    expect(detail.closeResult).toEqual({
      ok: true,
      held: true,
      branch: "zz/session-x",
      pending: 0,
    });

    await sleep(300); // give any would-be duplicate close a beat
    const calls = readFileSync(marker, "utf8").trim().split("\n");
    // EXACTLY ONE finalize (no duplicate) + the close-time observe (U5) — two CLI calls.
    expect(calls).toHaveLength(2);
    expect(calls.filter((c) => c.includes("worktree finalize"))).toHaveLength(1);
    expect(calls.some((c) => /session merge|worktree close/.test(c))).toBe(false); // never merges
    expect(calls.some((c) => /(^|\s)observe(\s|$)/.test(c))).toBe(true);
    server.stop();
  });

  it("absent zuzuu CLI → closeResult {cliAbsent:true}", async () => {
    const server = makeServer({
      commandAllowlist: ["/bin/echo"],
      zuzuuBinary: "definitely-not-a-real-binary-zzz",
    });
    const headers = await authedHeaders(server);
    const created = await (
      await postJson(server, headers, { command: "/bin/echo", type: "agent" })
    ).json();
    let detail: Record<string, unknown> = {};
    await waitFor(async () => {
      detail = await (await server.app.request(`/api/sessions/${created.id}`, { headers })).json();
      return detail.closeResult !== undefined;
    });
    expect(detail.closeResult).toEqual({ cliAbsent: true });
    server.stop();
  });

  it("failed finalize → closeResult {ok:false, stderr}", async () => {
    const stub = path.join(root, "zuzuu-fail.sh");
    writeFileSync(stub, `#!/bin/sh\necho 'finalize kaboom' >&2\nexit 1\n`);
    chmodSync(stub, 0o755);
    const server = makeServer({ commandAllowlist: ["/bin/echo"], zuzuuBinary: stub });
    const headers = await authedHeaders(server);
    const created = await (
      await postJson(server, headers, { command: "/bin/echo", type: "agent" })
    ).json();
    let detail: Record<string, unknown> = {};
    await waitFor(async () => {
      detail = await (await server.app.request(`/api/sessions/${created.id}`, { headers })).json();
      return detail.closeResult !== undefined;
    });
    expect(detail.closeResult).toMatchObject({ ok: false });
    expect((detail.closeResult as { stderr: string }).stderr).toMatch(/finalize kaboom/);
    server.stop();
  });

  it("shell-typed command exit never triggers a finalize", async () => {
    const { stub, marker } = finalizeStub(root);
    const server = makeServer({ commandAllowlist: ["/bin/echo"], zuzuuBinary: stub });
    const headers = await authedHeaders(server);
    const created = await (
      await postJson(server, headers, { command: "/bin/echo", args: ["bye"] }) // type defaults to shell
    ).json();
    expect(created.type).toBe("shell");
    await waitFor(async () => {
      const detail = await (await server.app.request(`/api/sessions/${created.id}`, { headers })).json();
      return detail.alive === false;
    });
    await sleep(300);
    expect(existsSync(marker)).toBe(false);
    const detail = await (await server.app.request(`/api/sessions/${created.id}`, { headers })).json();
    expect(detail.closeResult).toBeUndefined();
    server.stop();
  });

  it("GET /api/sessions/:id → 404 for unknown ids", async () => {
    const server = makeServer();
    const headers = await authedHeaders(server);
    expect((await server.app.request("/api/sessions/deadbeef", { headers })).status).toBe(404);
    server.stop();
  });
});

describe("Wave B: worktree-backed agent sessions", () => {
  it("an agent at the workspace root spawns in its own worktree dir", async () => {
    const { stub, wt } = worktreeStub(root);
    const server = makeServer({ commandAllowlist: ["/bin/echo"], zuzuuBinary: stub });
    const headers = await authedHeaders(server);
    const created = await (
      await postJson(server, headers, { command: "/bin/echo", args: ["hi"], type: "agent", host: "claude" })
    ).json();
    // the PTY's cwd is the worktree the CLI returned, not the workspace root
    expect(created.cwd).toBe(realpathSync(wt));
    expect(created.cwd).not.toBe(root);
    server.stop();
  });

  it("worktree-backed agent exit FINALIZES (holds) via `session worktree finalize`, NOT a merge", async () => {
    const { stub, marker } = worktreeStub(root);
    const server = makeServer({ commandAllowlist: ["/bin/echo"], zuzuuBinary: stub });
    const headers = await authedHeaders(server);
    const created = await (
      await postJson(server, headers, { command: "/bin/echo", args: ["bye"], type: "agent", host: "claude" })
    ).json();
    let detail: Record<string, unknown> = {};
    await waitFor(async () => {
      detail = await (await server.app.request(`/api/sessions/${created.id}`, { headers })).json();
      return detail.closeResult !== undefined;
    });
    // U3: END holds the worktree branch (the `held` variant) — no merge. U5/KTD5:
    // `pending` (0 on this empty temp `.zuzuu`) rides after the close-time `zz observe`.
    expect(detail.closeResult).toEqual({
      ok: true,
      held: true,
      branch: "zz/session-agent",
      pending: 0,
    });
    await sleep(200);
    // the worktree stub doesn't log `observe` (no marker arm) → still one logged call.
    const calls = readFileSync(marker, "utf8").trim().split("\n");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`session worktree finalize ${created.id}`);
    expect(calls[0]).not.toContain("session merge");
    expect(calls[0]).not.toContain("worktree close");
    server.stop();
  });

  it("an explicit subdir cwd opts OUT of worktree backing (runs in place)", async () => {
    const { stub } = worktreeStub(root);
    const sub = path.join(root, "sub");
    mkdirSync(sub);
    const server = makeServer({ commandAllowlist: ["/bin/echo"], zuzuuBinary: stub });
    const headers = await authedHeaders(server);
    const created = await (
      await postJson(server, headers, { command: "/bin/echo", args: ["x"], type: "agent", cwd: "sub" })
    ).json();
    expect(created.cwd).toBe(realpathSync(sub)); // ran in the subdir, in place
    expect(created.cwd).not.toContain(".worktrees"); // never opened a worktree
    server.stop();
  });
});

// tests/e2e — the end-to-end proof that the ported engine works over a REAL
// socket: a browser-shaped client opens the binary terminal WS, runs a command
// on a real PTY, and reads its output back; then floods past the flow-control
// high-water mark and drains it via acks. The flood test is the one that matters
// — if the ack → pause/resume loop were broken, the daemon would pause the PTY at
// 128 KB and never resume, so FLOOD_DONE would never arrive and this times out.
//
// Unlike the unit suites (which drive the SessionManager directly), this goes
// through createDaemon → a listening port → the ws upgrade → frames → the PTY.

import { describe, it, expect, afterEach } from "vitest";
import crypto from "node:crypto";
import net from "node:net";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { WebcodeServer } from "../../src/server/server.js";
import { decodeFrame, encodeFrame } from "../../src/server/frames.js";
import { ClientOp, ServerOp, FLOW_HIGH_WATER } from "#shared/index.js";

const TOKEN = "test-token";
// The browser presents this cookie (= base64url(sha256(token))) on the ws upgrade.
const COOKIE = `webcode_auth=${crypto.createHash("sha256").update(TOKEN).digest("base64url")}`;

let server: WebcodeServer | null = null;
let root: string | null = null;

/** Grab a real free port up front so cfg.port == the bound port — the AuthGate
 *  builds its Host allowlist from cfg.port, so `127.0.0.1:<port>` must match. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
  });
}

async function start(): Promise<number> {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-e2e-")));
  const port = await freePort();
  server = new WebcodeServer({
    root, port, host: "127.0.0.1", token: TOKEN, webDist: root, version: "0.0.0-test",
  });
  return new Promise<number>((resolve) => server!.start((p) => resolve(p)));
}

afterEach(() => {
  server?.stop();
  server = null;
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

/** Create a shell session via the in-memory app (authed by the cookie). */
async function createSession(): Promise<string> {
  const res = await server!.app.request("/api/sessions", {
    method: "POST",
    headers: { host: "localhost", cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({ type: "shell" }),
  });
  expect(res.ok).toBe(true); // 201 Created
  return ((await res.json()) as { id: string }).id;
}

function openTerm(id: string, port: number): WebSocket {
  // Natural Host (127.0.0.1:<port>) is in the gate's allowlist because the server
  // was started on this exact port; the browser presents the token-derived cookie.
  return new WebSocket(`ws://127.0.0.1:${port}/ws/term/${id}`, {
    headers: { cookie: COOKIE },
  });
}

describe("e2e: terminal WS over a real socket", () => {
  it("runs a command on the PTY and streams its output back", async () => {
    const port = await start();
    const id = await createSession();
    const ws = openTerm(id, port);
    let out = "";
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no result; saw: ${JSON.stringify(out.slice(-200))}`)), 15000);
      // `$((6*7))` evaluates to 42 ONLY when the shell executes it — the typed
      // echo carries the literal, so matching "RT_42_END" proves a real round-trip.
      ws.on("open", () => ws.send(encodeFrame(ClientOp.Input, "echo RT_$((6*7))_END\n")));
      ws.on("message", (data: Buffer) => {
        const { op, payload } = decodeFrame(data as Buffer);
        if (op === ServerOp.Output || op === ServerOp.Replay) out += payload.toString("utf8");
        if (out.includes("RT_42_END")) { clearTimeout(timer); resolve(); }
      });
      ws.on("error", reject);
    });
    ws.close();
    expect(out).toContain("RT_42_END");
  }, 20000);

  it("floods past the high-water mark and drains via acks (flow control lives)", async () => {
    const port = await start();
    const id = await createSession();
    const ws = openTerm(id, port);
    const FLOOD = FLOW_HIGH_WATER * 3; // ~384 KB — well past the pause threshold
    let received = 0;
    let done = false;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`flood stalled at ${received} bytes (flow control deadlock?)`)), 30000);
      // ~400 KB via shell builtins only (no yes/head/seq dependency): 4000 lines
      // of 100 'x'. Comfortably past FLOOD (3× high-water), so the PTY must pause
      // and resume to deliver it all. The DONE sentinel is COMPUTED ($((6*7))→42)
      // so it appears only when the shell EXECUTES the line — not in the PTY's echo
      // of the typed command (which would resolve us before any flood flowed).
      const LINE = "x".repeat(100);
      const FLOOD_CMD = `n=0; while [ $n -lt 4000 ]; do printf '%s\\n' '${LINE}'; n=$((n+1)); done; echo FLOOD_$((6*7))_DONE\n`;
      ws.on("open", () => ws.send(encodeFrame(ClientOp.Input, FLOOD_CMD)));
      ws.on("message", (data: Buffer) => {
        const { op, payload } = decodeFrame(data as Buffer);
        if (op !== ServerOp.Output) return; // Replay is excluded from flow accounting
        received += payload.length;
        // Ack like a real client would — this is what lets the daemon resume.
        ws.send(encodeFrame(ClientOp.Ack, JSON.stringify({ bytes: payload.length })));
        if (payload.toString("utf8").includes("FLOOD_42_DONE")) { done = true; clearTimeout(timer); resolve(); }
      });
      ws.on("error", reject);
    });
    ws.close();
    expect(done).toBe(true);
    // > one high-water of bytes flowed, so the PTY was paused AND resumed.
    expect(received).toBeGreaterThan(FLOW_HIGH_WATER);
  }, 40000);
});

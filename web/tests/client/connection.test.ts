// tests/client/connection — the client half of the flow-control loop, proven
// without a browser: a fake WebSocket + a fake xterm Terminal. The point is that
// rendered Output bytes get acked back (so the daemon can pause/resume the PTY).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ClientOp, ServerOp, ACK_INTERVAL } from "../../src/shared/index.js";

// --- fakes installed as globals before importing the module under test ---
let sockets: FakeWS[] = [];
class FakeWS {
  static CONNECTING = 0;
  static OPEN = 1;
  readyState = FakeWS.OPEN;
  binaryType = "";
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: ArrayBuffer }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  sent: Uint8Array[] = [];
  constructor(readonly url: string) {
    sockets.push(this);
  }
  send(buf: Uint8Array) {
    this.sent.push(buf);
  }
  close() {}
}

const fakeTerm = {
  cols: 80,
  rows: 24,
  // write invokes the render callback synchronously → drives the ack accounting
  write: (_data: Uint8Array, cb?: () => void) => cb?.(),
  reset: () => {},
} as unknown as import("@xterm/xterm").Terminal;

function outputFrame(bytes: number): { data: ArrayBuffer } {
  const buf = new Uint8Array(1 + bytes);
  buf[0] = ServerOp.Output;
  return { data: buf.buffer };
}

beforeEach(() => {
  sockets = [];
  vi.stubGlobal("WebSocket", FakeWS);
  vi.stubGlobal("location", { protocol: "http:", host: "localhost:7770" });
});
afterEach(() => vi.unstubAllGlobals());

describe("TermConnection flow control", () => {
  it("acks rendered Output bytes once they cross ACK_INTERVAL", async () => {
    const { TermConnection } = await import("../../src/client/term/connection.js");
    const conn = new TermConnection("abc", fakeTerm, {
      onStatus: () => {}, onTitle: () => {}, onExit: () => {}, onCwd: () => {},
    });
    conn.connect();
    const ws = sockets[0]!;
    ws.onopen!(); // socket opens → a Resize frame is the first thing sent

    // one big burst past the interval → an immediate ack flush
    ws.onmessage!(outputFrame(ACK_INTERVAL + 10));

    const ack = ws.sent.map((b) => b).find((b) => b[0] === ClientOp.Ack);
    expect(ack, "an Ack frame was sent").toBeTruthy();
    const { bytes } = JSON.parse(new TextDecoder().decode(ack!.subarray(1))) as { bytes: number };
    expect(bytes).toBe(ACK_INTERVAL + 10);
    conn.dispose();
  });

  it("does not ack tiny bursts immediately (waits to batch)", async () => {
    const { TermConnection } = await import("../../src/client/term/connection.js");
    const conn = new TermConnection("abc", fakeTerm, {
      onStatus: () => {}, onTitle: () => {}, onExit: () => {}, onCwd: () => {},
    });
    conn.connect();
    const ws = sockets[0]!;
    ws.onopen!();
    ws.onmessage!(outputFrame(100)); // well under ACK_INTERVAL
    expect(ws.sent.some((b) => b[0] === ClientOp.Ack)).toBe(false);
    conn.dispose();
  });
});

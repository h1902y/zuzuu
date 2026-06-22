// src/client/term/connection.ts — the client side of the binary terminal wire.
//
// Mirrors the daemon's flow control: every payload fully written to xterm (the
// write callback fired) is acked back, so the daemon can PAUSE the PTY when the
// browser falls behind and resume when it catches up. Plus indefinite reconnect
// (reconnect.ts) with instant recovery on network-return / tab-refocus. This is
// the proven hot path — kept faithful to the v1 client, only the protocol import
// changed (now #shared).

import type { Terminal } from "@xterm/xterm";
import { ACK_INTERVAL, ClientOp, ServerOp, type CwdPayload } from "#shared/index.js";
import { wsUrl } from "../lib/api.js";
import { reconnectDecision } from "./reconnect.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function frame(op: number, payload: Uint8Array | string): Uint8Array<ArrayBuffer> {
  const body = typeof payload === "string" ? encoder.encode(payload) : payload;
  const buf = new Uint8Array(1 + body.length);
  buf[0] = op;
  buf.set(body, 1);
  return buf;
}

export interface ConnectionEvents {
  onTitle: (title: string) => void;
  onExit: (exitCode: number) => void;
  onStatus: (status: "connecting" | "open" | "reconnecting" | "closed") => void;
  onCwd: (cwd: CwdPayload) => void;
  /** Fires once, on the FIRST output byte — a real "the host has started
   *  rendering" signal (socket-open is too early; the TUI hasn't drawn yet). */
  onFirstOutput?: () => void;
}

export class TermConnection {
  private ws: WebSocket | null = null;
  private unacked = 0;
  private retries = 0;
  private closedByUser = false;
  private firstReplayDone = false;
  private everOpened = false;
  private everOutput = false;
  private openWaiters: (() => void)[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private ackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly sessionId: string,
    private readonly term: Terminal,
    private readonly events: ConnectionEvents,
  ) {
    // Recover instantly on network-return / tab-refocus instead of waiting out
    // the backoff. The server PTY persists, so reattach replays a fresh snapshot.
    if (typeof window !== "undefined") window.addEventListener("online", this.wake);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.wake);
  }

  /** Reconnect now if we're disconnected (and the user didn't close us). */
  private readonly wake = (): void => {
    if (this.closedByUser) return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;
    this.retries = 0; // a wake is a fresh start — don't carry backoff
    this.connect();
  };

  connect(): void {
    if (this.closedByUser) return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.events.onStatus(this.retries > 0 ? "reconnecting" : "connecting");
    const ws = new WebSocket(wsUrl(`/ws/term/${this.sessionId}`));
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.everOpened = true;
      for (const resolve of this.openWaiters.splice(0)) resolve();
      this.events.onStatus("open");
      this.sendResize(this.term.cols, this.term.rows);
    };

    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      const data = new Uint8Array(ev.data);
      if (data.length === 0) return;
      const op = data[0]!;
      const payload = data.subarray(1);
      switch (op) {
        case ServerOp.Replay:
          // a reconnect replay replaces the screen — start clean
          if (this.firstReplayDone) this.term.reset();
          this.firstReplayDone = true;
          this.term.write(payload);
          break;
        case ServerOp.Output:
          if (!this.everOutput) {
            this.everOutput = true;
            this.events.onFirstOutput?.();
          }
          // ack only after xterm has actually rendered — true backpressure
          this.term.write(payload, () => this.ack(payload.length));
          break;
        case ServerOp.Exit:
          this.events.onExit((JSON.parse(decoder.decode(payload)) as { exitCode: number }).exitCode);
          break;
        case ServerOp.Title:
          this.events.onTitle((JSON.parse(decoder.decode(payload)) as { title: string }).title);
          break;
        case ServerOp.Cwd:
          this.events.onCwd(JSON.parse(decoder.decode(payload)) as CwdPayload);
          break;
      }
    };

    ws.onclose = (ev) => {
      this.ws = null;
      const { retry, delayMs } = reconnectDecision({ retries: this.retries, code: ev.code, closedByUser: this.closedByUser });
      if (!retry) return this.events.onStatus("closed");
      this.retries += 1;
      this.events.onStatus("reconnecting");
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (!this.closedByUser) this.connect();
      }, delayMs);
    };
  }

  /** Resolves once the socket has opened (immediately if it ever has). */
  whenOpen(): Promise<void> {
    if (this.everOpened) return Promise.resolve();
    return new Promise((resolve) => this.openWaiters.push(resolve));
  }

  sendInput(data: string): void {
    this.send(frame(ClientOp.Input, data));
  }

  sendResize(cols: number, rows: number): void {
    this.send(frame(ClientOp.Resize, JSON.stringify({ cols, rows })));
  }

  private ack(bytes: number): void {
    this.unacked += bytes;
    if (this.unacked >= ACK_INTERVAL) this.flushAck();
    else if (this.ackTimer === null) this.ackTimer = setTimeout(() => this.flushAck(), 50);
  }

  private flushAck(): void {
    if (this.ackTimer !== null) {
      clearTimeout(this.ackTimer);
      this.ackTimer = null;
    }
    if (this.unacked > 0) {
      this.send(frame(ClientOp.Ack, JSON.stringify({ bytes: this.unacked })));
      this.unacked = 0;
    }
  }

  private send(buf: Uint8Array<ArrayBuffer>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(buf);
  }

  dispose(): void {
    this.closedByUser = true;
    if (this.ackTimer !== null) clearTimeout(this.ackTimer);
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    if (typeof window !== "undefined") window.removeEventListener("online", this.wake);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.wake);
    this.ws?.close(1000);
    this.ws = null;
  }
}

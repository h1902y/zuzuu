import type { Terminal } from "@xterm/xterm";
import { ACK_INTERVAL, ClientOp, ServerOp, type CwdPayload } from "@zuzuu-web/protocol";
import { wsUrl } from "../lib/api";
import { reconnectDecision } from "./reconnect";

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
  /** Fires once, on the FIRST output byte from the PTY — a real "the host has
   *  started rendering" signal (used to gate start-with-a-task injection and to
   *  flip the composer's starting→running state). Socket-open alone is too
   *  early: the TUI hasn't drawn its input yet and swallows keystrokes. */
  onFirstOutput?: () => void;
}

/**
 * Client side of the terminal wire protocol. Mirrors the daemon's flow
 * control: every payload fully written to xterm.js (write callback fired) is
 * acked back, so the daemon can pause the PTY when the browser falls behind.
 */
export class TermConnection {
  private ws: WebSocket | null = null;
  private unacked = 0;
  private retries = 0;
  private closedByUser = false;
  private firstReplayDone = false;
  private everOpened = false;
  private everOutput = false;
  private openWaiters: (() => void)[] = [];
  private outputWaiters: (() => void)[] = [];

  constructor(
    private readonly sessionId: string,
    private readonly term: Terminal,
    private readonly events: ConnectionEvents,
  ) {}

  connect(): void {
    this.events.onStatus(this.retries > 0 ? "reconnecting" : "connecting");
    const ws = new WebSocket(wsUrl(`/ws/term/${this.sessionId}`));
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.everOpened = true;
      for (const resolve of this.openWaiters.splice(0)) resolve();
      this.events.onStatus("open");
      // tell the daemon our true size before anything renders
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
            for (const resolve of this.outputWaiters.splice(0)) resolve();
            this.events.onFirstOutput?.();
          }
          this.term.write(payload, () => this.ack(payload.length));
          break;
        case ServerOp.Exit: {
          const { exitCode } = JSON.parse(decoder.decode(payload)) as { exitCode: number };
          this.events.onExit(exitCode);
          break;
        }
        case ServerOp.Title: {
          const { title } = JSON.parse(decoder.decode(payload)) as { title: string };
          this.events.onTitle(title);
          break;
        }
        case ServerOp.Cwd:
          this.events.onCwd(JSON.parse(decoder.decode(payload)) as CwdPayload);
          break;
      }
    };

    ws.onclose = (ev) => {
      this.ws = null;
      const { retry, delayMs } = reconnectDecision({
        retries: this.retries,
        code: ev.code,
        closedByUser: this.closedByUser,
      });
      if (!retry) {
        this.events.onStatus("closed");
        return;
      }
      this.retries += 1;
      this.events.onStatus("reconnecting");
      setTimeout(() => {
        if (!this.closedByUser) this.connect();
      }, delayMs);
    };
  }

  /** Resolves once the socket has opened (immediately if it ever has) —
   *  lets non-terminal UI inject input right after creating a session. */
  whenOpen(): Promise<void> {
    if (this.everOpened) return Promise.resolve();
    return new Promise((resolve) => this.openWaiters.push(resolve));
  }

  /** Resolves on the first PTY output (the host has started rendering) — or
   *  after `timeoutMs` as a fallback so a silent host never hangs the caller.
   *  Resolves immediately if output has already arrived. */
  whenFirstOutput(timeoutMs = 0): Promise<void> {
    if (this.everOutput) return Promise.resolve();
    return new Promise((resolve) => {
      this.outputWaiters.push(resolve);
      if (timeoutMs > 0) setTimeout(resolve, timeoutMs); // resolve() is idempotent
    });
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
    else this.scheduleAckFlush();
  }

  private ackTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleAckFlush(): void {
    if (this.ackTimer !== null) return;
    this.ackTimer = setTimeout(() => this.flushAck(), 50);
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
    this.ws?.close(1000);
    this.ws = null;
  }
}

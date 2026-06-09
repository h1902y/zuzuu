import os from "node:os";
import crypto from "node:crypto";
import pty from "@lydell/node-pty";
import type { IPty } from "@lydell/node-pty";
import xtermHeadless from "@xterm/headless";
import addonSerialize from "@xterm/addon-serialize";
import type { Terminal as HeadlessTerminal } from "@xterm/headless";

// Both packages are CJS bundles without ESM named exports.
const { Terminal } = xtermHeadless;
const { SerializeAddon } = addonSerialize;
import type { WebSocket } from "ws";
import {
  ServerOp,
  FLOW_HIGH_WATER,
  FLOW_LOW_WATER,
  type SessionInfo,
} from "@webcode/protocol";
import { encodeFrame } from "./frames.js";

const SCROLLBACK = 10_000;

function pickShell(): string {
  if (process.platform === "win32") return process.env.COMSPEC ?? "cmd.exe";
  return process.env.SHELL ?? (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
}

/**
 * A PTY whose lifetime is decoupled from any WebSocket. A headless xterm
 * mirrors all output so a (re)attaching client gets an accurate replay of
 * screen + scrollback via the serialize addon, then streams live.
 *
 * Flow control: while a client is attached we count PTY output bytes in
 * flight (sent but not yet acked by the client's `term.write` callbacks).
 * Above the high-water mark the PTY is paused — backpressure propagates to
 * the kernel pty buffer, so `yes` / giant `cat` never overruns the browser.
 */
export class Session {
  readonly id = crypto.randomBytes(8).toString("hex");
  readonly createdAt = Date.now();
  title: string;
  alive = true;
  private readonly pty: IPty;
  private readonly mirror: HeadlessTerminal;
  private readonly serializer = new SerializeAddon();
  private socket: WebSocket | null = null;
  private inflight = 0;
  private paused = false;
  private exitPayload: string | null = null;

  constructor(
    readonly cwd: string,
    cols = 80,
    rows = 24,
    private readonly onUpdate: () => void,
  ) {
    const shell = pickShell();
    this.title = shell.split("/").pop() ?? shell;
    this.mirror = new Terminal({ cols, rows, scrollback: SCROLLBACK, allowProposedApi: true });
    this.mirror.loadAddon(this.serializer);
    this.pty = pty.spawn(shell, process.platform === "win32" ? [] : ["-l"], {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        WEBCODE: "1",
      },
    });

    this.pty.onData((data) => {
      this.mirror.write(data);
      const proc = this.pty.process;
      if (proc && proc !== this.title) {
        this.title = proc;
        this.send(encodeFrame(ServerOp.Title, JSON.stringify({ title: this.title })));
        this.onUpdate();
      }
      if (this.socket) {
        const frame = encodeFrame(ServerOp.Output, Buffer.from(data, "utf8"));
        this.inflight += frame.length - 1;
        this.send(frame);
        if (!this.paused && this.inflight > FLOW_HIGH_WATER) {
          this.paused = true;
          this.pty.pause();
        }
      }
    });

    this.pty.onExit(({ exitCode, signal }) => {
      this.alive = false;
      this.exitPayload = JSON.stringify({ exitCode, signal });
      this.send(encodeFrame(ServerOp.Exit, this.exitPayload));
      this.onUpdate();
    });
  }

  /** Single-attachment model: a new client takes over the session. */
  attach(ws: WebSocket): void {
    if (this.socket && this.socket !== ws) {
      this.socket.close(4000, "session attached elsewhere");
    }
    this.socket = ws;
    this.resetFlow();
    const snapshot = this.serializer.serialize({ scrollback: SCROLLBACK });
    ws.send(encodeFrame(ServerOp.Replay, snapshot));
    if (!this.alive && this.exitPayload) {
      ws.send(encodeFrame(ServerOp.Exit, this.exitPayload));
    }
  }

  detach(ws: WebSocket): void {
    if (this.socket === ws) {
      this.socket = null;
      this.resetFlow();
    }
  }

  write(data: string): void {
    if (this.alive) this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    if (!Number.isInteger(cols) || !Number.isInteger(rows)) return;
    if (cols < 2 || rows < 1 || cols > 1000 || rows > 1000) return;
    this.mirror.resize(cols, rows);
    if (this.alive) this.pty.resize(cols, rows);
  }

  /** Client reports bytes it has finished rendering. */
  ack(bytes: number): void {
    if (!Number.isFinite(bytes) || bytes < 0) return;
    this.inflight = Math.max(0, this.inflight - bytes);
    if (this.paused && this.inflight < FLOW_LOW_WATER) {
      this.paused = false;
      if (this.alive) this.pty.resume();
    }
  }

  /** Nobody is listening: stop counting and let the PTY run free. */
  private resetFlow(): void {
    this.inflight = 0;
    if (this.paused) {
      this.paused = false;
      if (this.alive) this.pty.resume();
    }
  }

  private send(frame: Buffer): void {
    if (this.socket && this.socket.readyState === this.socket.OPEN) {
      this.socket.send(frame);
    }
  }

  kill(): void {
    this.socket?.close(1000, "session closed");
    this.socket = null;
    if (this.alive) {
      try {
        this.pty.kill();
      } catch {
        // already gone
      }
    }
    this.mirror.dispose();
  }

  info(): SessionInfo {
    return {
      id: this.id,
      title: this.title,
      cwd: this.cwd,
      alive: this.alive,
      createdAt: this.createdAt,
    };
  }
}

export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly defaultCwd: string = os.homedir()) {}

  create(cwd?: string, cols?: number, rows?: number): Session {
    const session = new Session(cwd ?? this.defaultCwd, cols, rows, () => {});
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  list(): SessionInfo[] {
    return [...this.sessions.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => s.info());
  }

  close(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.kill();
    this.sessions.delete(id);
    return true;
  }

  shutdown(): void {
    for (const session of this.sessions.values()) session.kill();
    this.sessions.clear();
  }
}

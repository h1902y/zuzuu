// web/src/server/acp.ts — the ACP "drive lane", daemon side (Spike #2).
//
// what: the daemon is the ACP CLIENT. It spawns the `claude-agent-acp` adapter as a
//       long-lived child, runs a ClientSideConnection over its stdio, and relays the
//       structured `session/update` stream to a browser WebSocket. The browser is a
//       thin renderer + composer; protocol/fs/(future)gate stay server-side.
// why:  own the conversation UX off the host TUI + record a structured trace, while
//       the host SDK keeps the agent loop and rides the Claude Code subscription
//       (Spike #1 confirmed the no-key subscription path).
// how:  mirrors ws-fs.ts (JSON text frames) for the wire, and zuzuu-cli.ts (spawn
//       shape) + SessionManager (keep-alive, keyed by id, killed on close) for the
//       process. The trace is the in-memory log of relayed messages, replayed to a
//       (re)joining socket. Single-consumer per session (one workbench tab) for now.
import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import type { WebSocket } from "ws";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION, type Client } from "@agentclientprotocol/sdk";
import type { AcpClientMessage, AcpServerMessage, AcpSessionUpdate, AcpUsage } from "#shared/index.js";

const STDERR_TAIL = 4000;

/** Resolve the installed adapter's bin entry (dist/index.js) without depending on PATH. */
function resolveAdapterBin(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@agentclientprotocol/claude-agent-acp/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { bin?: string | Record<string, string> };
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.["claude-agent-acp"];
  if (!rel) throw new Error("claude-agent-acp: no bin entry in package.json");
  return join(dirname(pkgPath), rel);
}

/** A child env with the provider auth vars stripped, so the adapter uses the local
 *  Claude Code login (the subscription path), never a key from this daemon's env. */
function childEnv(): NodeJS.ProcessEnv {
  const e: NodeJS.ProcessEnv = { ...process["env"] };
  const P = "ANTHROPIC_";
  for (const seg of ["API_" + "KEY", "AUTH_" + "TOKEN", "BASE_URL"]) delete e[P + seg];
  return e;
}

type Emit = (msg: AcpServerMessage) => void;

/** One ACP conversation = one adapter subprocess + one ClientSideConnection. */
export class AcpSession {
  readonly id = randomBytes(8).toString("hex");
  private readonly child: ChildProcess;
  private readonly conn: ClientSideConnection;
  private sessionId: string | null = null;
  private emit: Emit = () => {};
  private stderrTail = "";
  /** the recorded structured stream — the trace; replayed to a (re)joining socket. */
  readonly trace: AcpServerMessage[] = [];

  constructor(private readonly cwd: string, adapterBin: string) {
    this.child = spawn(process.execPath, [adapterBin], { cwd, stdio: ["pipe", "pipe", "pipe"], env: childEnv() });
    this.child.stderr?.on("data", (d: Buffer) => {
      this.stderrTail = (this.stderrTail + d.toString()).slice(-STDERR_TAIL);
    });
    this.child.on("exit", (code) => {
      this.push({ type: "error", message: `adapter exited (code ${code})${this.stderrTail ? `: ${this.stderrTail.slice(-400)}` : ""}` });
    });

    const stream = ndJsonStream(
      Writable.toWeb(this.child.stdin!) as WritableStream<Uint8Array>,
      Readable.toWeb(this.child.stdout!) as ReadableStream<Uint8Array>,
    );

    const client: Client = {
      // Spike #2: auto-approve. Spike #3 routes this through the guardrails gate.
      requestPermission: async (params) => {
        const opts = params.options ?? [];
        const pick = opts.find((o) => /allow/i.test(o.kind ?? "")) ?? opts[0];
        return pick
          ? { outcome: { outcome: "selected", optionId: pick.optionId } }
          : { outcome: { outcome: "cancelled" } };
      },
      sessionUpdate: async (params) => {
        this.push({ type: "update", update: params.update as unknown as AcpSessionUpdate });
      },
    };
    this.conn = new ClientSideConnection(() => client, stream);
  }

  private push(msg: AcpServerMessage): void {
    this.trace.push(msg);
    this.emit(msg);
  }

  /** Handshake + open a session. Throws (caller maps to an error frame) on auth/spawn failure. */
  async start(): Promise<void> {
    await this.conn.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    });
    const s = await this.conn.newSession({ cwd: this.cwd, mcpServers: [] });
    this.sessionId = s.sessionId;
    this.push({ type: "ready", sessionId: s.sessionId });
  }

  async prompt(text: string): Promise<void> {
    if (!this.sessionId) return;
    try {
      const res = await this.conn.prompt({ sessionId: this.sessionId, prompt: [{ type: "text", text }] });
      this.push({ type: "turn_end", stopReason: res.stopReason, usage: res.usage as AcpUsage | undefined });
    } catch (e) {
      this.push({ type: "error", message: String((e as Error)?.message ?? e) });
    }
  }

  async cancel(): Promise<void> {
    if (!this.sessionId) return;
    try { await this.conn.cancel({ sessionId: this.sessionId }); } catch { /* best-effort */ }
  }

  /** Bind a socket: replay the trace so a (re)joining client sees prior state, then stream live. */
  attach(emit: Emit): void {
    this.emit = emit;
    for (const m of this.trace) emit(m);
  }
  detach(): void {
    this.emit = () => {};
  }

  kill(): void {
    this.detach();
    try { this.child.kill(); } catch { /* ignore */ }
  }
}

/** Registry of live ACP sessions (mirror of SessionManager). */
export class AcpManager {
  private readonly byId = new Map<string, AcpSession>();
  private adapterBin: string | null = null;

  constructor(private readonly cwd: () => string) {}

  private bin(): string {
    if (!this.adapterBin) this.adapterBin = resolveAdapterBin();
    return this.adapterBin;
  }

  async create(): Promise<AcpSession> {
    const s = new AcpSession(this.cwd(), this.bin());
    this.byId.set(s.id, s);
    await s.start();
    return s;
  }

  get(id: string): AcpSession | undefined {
    return this.byId.get(id);
  }

  close(id: string): void {
    const s = this.byId.get(id);
    if (s) { s.kill(); this.byId.delete(id); }
  }

  shutdown(): void {
    for (const s of this.byId.values()) s.kill();
    this.byId.clear();
  }
}

/** Relay a browser socket ⇄ an ACP session (mirror handleFsSocket). */
export function handleAcpSocket(ws: WebSocket, session: AcpSession): void {
  const send = (msg: AcpServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  session.attach(send);
  ws.on("message", (raw) => {
    let msg: AcpClientMessage;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === "prompt") void session.prompt(msg.text);
    else if (msg.type === "cancel") void session.cancel();
  });
  ws.on("close", () => session.detach());
}

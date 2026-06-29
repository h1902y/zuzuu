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
import { resolveSpawn } from "./zuzuu-cli.js";

const STDERR_TAIL = 4000;

/** Map an ACP tool call → the {tool_name, tool_input} the guardrails gate evaluates.
 *  The gate canonicalizes tool names across hosts (execute→Bash, edit/delete/move→Write),
 *  so its existing rules (no-root-wipe, protect-brain-writes, no-secret-reads …) apply to
 *  ACP tool calls unchanged. Pure → tested. */
export function mapToolCall(tc: { kind?: string; title?: string; rawInput?: unknown }): { tool_name: string; tool_input: unknown } {
  const kind = String(tc.kind ?? "other");
  const tool_name =
    kind === "execute" ? "Bash" :
    kind === "edit" || kind === "delete" || kind === "move" ? "Write" :
    kind; // read · search · fetch · think · other → matched by tool:'*' rules
  return { tool_name, tool_input: tc.rawInput ?? { title: tc.title ?? "" } };
}

/** Evaluate a tool call against the project's guardrails by shelling the SAME entry the
 *  host hook uses — `zz hook PreToolUse` (reads the payload on stdin, prints a deny/ask
 *  decision, empty = allow). Keeps the daemon→CLI boundary intact (never imports src/).
 *  Fail-open: any spawn/parse failure → null (allow/defer), never a wrong block. */
function gateCheck(cwd: string, binary: string, tool_name: string, tool_input: unknown): Promise<{ action: string; reason: string } | null> {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    const finish = (v: { action: string; reason: string } | null) => { if (!done) { done = true; resolve(v); } };
    let child;
    try {
      const { cmd, argv } = resolveSpawn(binary, ["hook", "PreToolUse"]);
      child = spawn(cmd, argv, { cwd, stdio: ["pipe", "pipe", "ignore"] });
    } catch { finish(null); return; }
    const timer = setTimeout(() => { try { child!.kill(); } catch { /* noop */ } finish(null); }, 5000);
    child.stdout?.on("data", (b: Buffer) => { out += b.toString(); });
    child.on("error", () => { clearTimeout(timer); finish(null); });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const d = JSON.parse(out) as { hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string } };
        const pd = d.hookSpecificOutput?.permissionDecision;
        if (pd === "deny" || pd === "ask" || pd === "allow") {
          finish({ action: pd, reason: d.hookSpecificOutput?.permissionDecisionReason ?? "" });
        } else finish(null);
      } catch { finish(null); } // empty/garbage stdout = no rule matched → allow/defer
    });
    try {
      child.stdin?.write(JSON.stringify({ hook_event_name: "PreToolUse", tool_name, tool_input, session_id: "acp" }));
      child.stdin?.end();
    } catch { /* the close/error handler resolves */ }
  });
}

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
  /** in-flight gate "ask"s awaiting the human's Allow/Deny (Spike #3). */
  private readonly pending = new Map<string, (d: "allow" | "deny") => void>();

  constructor(private readonly cwd: string, adapterBin: string, private readonly binary: string) {
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
      // Spike #3: route every permission request through the guardrails gate.
      // deny → block; allow → proceed; ask / no-rule → the human decides in the UI.
      requestPermission: async (params) => {
        const tc = (params.toolCall ?? {}) as { kind?: string; title?: string; rawInput?: unknown };
        const title = tc.title ?? tc.kind ?? "tool call";
        const { tool_name, tool_input } = mapToolCall(tc);
        const verdict = await gateCheck(this.cwd, this.binary, tool_name, tool_input);

        if (verdict?.action === "deny") {
          this.push({ type: "gate", decision: "deny", title, reason: verdict.reason });
          return this.outcome(params.options, false);
        }
        if (verdict?.action === "allow") {
          this.push({ type: "gate", decision: "allow", title, reason: verdict.reason });
          return this.outcome(params.options, true);
        }
        // "ask" (a rule), or no rule matched → the human gate, in the drive lane
        const requestId = randomBytes(6).toString("hex");
        this.push({ type: "permission", requestId, title, toolKind: tc.kind ?? "other", ...(verdict?.reason ? { reason: verdict.reason } : {}) });
        const decision = await this.awaitPermission(requestId);
        return this.outcome(params.options, decision === "allow");
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

  /** Pick an allow/reject permission option (a deny with no reject option → cancelled,
   *  which also blocks the turn). */
  private outcome(options: Array<{ optionId: string; kind?: string }> | undefined, allow: boolean) {
    const opts = options ?? [];
    const want = allow ? /allow/i : /reject|deny/i;
    const pick = opts.find((o) => want.test(o.kind ?? "")) ?? (allow ? opts[0] : undefined);
    return pick ? { outcome: { outcome: "selected" as const, optionId: pick.optionId } } : { outcome: { outcome: "cancelled" as const } };
  }

  /** Park a gate "ask" until the human replies (auto-deny after 3 min — fail-safe). */
  private awaitPermission(id: string): Promise<"allow" | "deny"> {
    return new Promise((resolve) => {
      const t = setTimeout(() => { this.pending.delete(id); resolve("deny"); }, 180_000);
      this.pending.set(id, (d) => { clearTimeout(t); this.pending.delete(id); resolve(d); });
    });
  }

  /** The browser's Allow/Deny answer to a pending gate "ask". */
  resolvePermission(id: string, decision: "allow" | "deny"): void {
    this.pending.get(id)?.(decision);
  }

  /** Handshake + open a session. Throws (caller maps to an error frame) on auth/spawn failure. */
  async start(): Promise<void> {
    await this.conn.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    });
    const s = await this.conn.newSession({ cwd: this.cwd, mcpServers: [] });
    this.sessionId = s.sessionId;
    // Delegate tool permissions to US (the client) so the guardrails gate is enforced.
    // The adapter otherwise resolves an auto-allow mode (acceptEdits/bypass) and never
    // asks the client — picking the mode that prompts makes requestPermission fire. The
    // mode id varies; prefer one that looks like "default"/"ask", else the first offered.
    try {
      const modes = (s as { modes?: { availableModes?: Array<{ id?: string; name?: string }> } }).modes;
      const avail = modes?.availableModes ?? [];
      const prompts = avail.find((m) => /default|ask|prompt/i.test(`${m.id ?? ""} ${m.name ?? ""}`));
      const modeId = prompts?.id ?? avail[0]?.id;
      if (modeId) await this.conn.setSessionMode({ sessionId: s.sessionId, modeId });
    } catch { /* mode-setting unsupported → keep the adapter's default */ }
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
  private readonly zuzuuBinary: string;

  constructor(private readonly cwd: () => string, opts: { zuzuuBinary?: string } = {}) {
    this.zuzuuBinary = opts.zuzuuBinary ?? "zuzuu"; // the gate-eval binary (zz hook PreToolUse)
  }

  private bin(): string {
    if (!this.adapterBin) this.adapterBin = resolveAdapterBin();
    return this.adapterBin;
  }

  async create(): Promise<AcpSession> {
    const s = new AcpSession(this.cwd(), this.bin(), this.zuzuuBinary);
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
    else if (msg.type === "permission") session.resolvePermission(msg.requestId, msg.decision);
  });
  ws.on("close", () => session.detach());
}

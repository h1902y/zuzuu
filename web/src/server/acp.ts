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

/** The gate's verdict for one tool call. `unavailable` = the gate COULD NOT run
 *  (spawn error / timeout / non-zero exit) — distinct from `null` (ran cleanly, no
 *  rule matched → defer to the human). R10b: a gate that fails to evaluate must be
 *  surfaced, never silently framed as a routine "ask" on the default lane. */
type GateVerdict = { action: "deny" | "allow" | "ask"; reason: string } | { action: "unavailable"; reason: string };

/** Evaluate a tool call against the project's guardrails by shelling the SAME entry the
 *  host hook uses — `zz hook PreToolUse` (reads the payload on stdin, prints a deny/ask
 *  decision, empty = allow). Keeps the daemon→CLI boundary intact (never imports src/).
 *  Distinguishes "no rule matched" (null → defer) from "gate couldn't run" (unavailable
 *  → the caller fails-visible), so a missing/stale/slow gate never silently allows. */
function gateCheck(cwd: string, binary: string, tool_name: string, tool_input: unknown): Promise<GateVerdict | null> {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    const finish = (v: GateVerdict | null) => { if (!done) { done = true; resolve(v); } };
    let child;
    try {
      const { cmd, argv } = resolveSpawn(binary, ["hook", "PreToolUse"]);
      child = spawn(cmd, argv, { cwd, stdio: ["pipe", "pipe", "ignore"] });
    } catch { finish({ action: "unavailable", reason: "guardrail binary could not be spawned" }); return; }
    const timer = setTimeout(() => { try { child!.kill(); } catch { /* noop */ } finish({ action: "unavailable", reason: "guardrail evaluation timed out" }); }, 5000);
    child.stdout?.on("data", (b: Buffer) => { out += b.toString(); });
    child.on("error", () => { clearTimeout(timer); finish({ action: "unavailable", reason: "guardrail process error" }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const d = JSON.parse(out) as { hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string } };
        const pd = d.hookSpecificOutput?.permissionDecision;
        if (pd === "deny" || pd === "ask" || pd === "allow") {
          finish({ action: pd, reason: d.hookSpecificOutput?.permissionDecisionReason ?? "" });
        } else finish(null); // ran, valid JSON, no decision → no rule matched
      } catch {
        // unparseable stdout: a clean exit (code 0) is the empty-output no-rule case
        // (JSON.parse("") throws) → defer; a non-zero exit means the gate errored → unavailable.
        finish(code === 0 ? null : { action: "unavailable", reason: `guardrail exited ${code ?? "abnormally"}` });
      }
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

/** The adapter's env — an explicit ALLOWLIST of variable names (R10d), not the whole
 *  daemon environment. Inheriting everything forwarded sensitive shell variables to the
 *  third-party adapter; we pass only what it + the local Claude Code login need. The
 *  provider access vars are omitted, so the adapter uses the local login. */
export function childEnv(): NodeJS.ProcessEnv {
  const ALLOW = [
    "PATH", "HOME", "SHELL", "USER", "LOGNAME", "LANG", "LC_ALL", "TERM", "TMPDIR",
    "XDG_RUNTIME_DIR", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME",
  ];
  const e: NodeJS.ProcessEnv = {};
  for (const k of ALLOW) { const v = process["env"][k]; if (v !== undefined) e[k] = v; }
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
  /** ADV-5: after the last consumer detaches, kill the adapter if no one reattaches
   *  within the grace, so a reload/close doesn't leave it running orphaned (a reload
   *  reconnects well inside the grace; trace-replay makes it lossless). */
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private killed = false;
  /** AcpManager wires this to drop the session from its registry on idle-close. */
  onIdleClose: () => void = () => {};

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
        if (verdict?.action === "unavailable") {
          // R10b: the gate COULD NOT run — surface it (never a silent routine "ask").
          // The human still decides, but the prompt is clearly flagged as degraded.
          const requestId = randomBytes(6).toString("hex");
          this.push({ type: "permission", requestId, title, toolKind: tc.kind ?? "other", reason: `⚠ Guardrail unavailable (${verdict.reason}) — the gate could not run; approve only if you trust this action.` });
          const decision = await this.awaitPermission(requestId);
          return this.outcome(params.options, decision === "allow");
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

  /** Park a gate "ask" until the human replies (auto-deny after 3 min — fail-safe).
   *  SEC-005: cap concurrent pending asks so a buggy/adversarial adapter can't grow the
   *  map unbounded — past the cap, auto-deny immediately. */
  private awaitPermission(id: string): Promise<"allow" | "deny"> {
    if (this.pending.size >= 16) return Promise.resolve("deny");
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
    // R10c: delegate tool permissions to US (the client) so the guardrails gate fires.
    // The adapter's DEFAULT mode auto-allows (acceptEdits/bypass) and never asks the
    // client — so we MUST pick a mode that prompts. Prefer an ask/default mode; never
    // blindly fall back to avail[0] (it may itself be auto-allow); if none can be
    // confirmed, surface it (SEC-002: don't let the gate be silently OFF for a session).
    try {
      const modes = (s as { modes?: { availableModes?: Array<{ id?: string; name?: string }> } }).modes;
      const avail = modes?.availableModes ?? [];
      const label = (m: { id?: string; name?: string }) => `${m.id ?? ""} ${m.name ?? ""}`;
      const prompting = avail.find((m) => /default|ask|prompt|review/i.test(label(m)));
      const nonAutoAllow = avail.find((m) => !/bypass|accept|auto|yolo|allow.?all|danger/i.test(label(m)));
      const chosen = prompting ?? nonAutoAllow;
      if (chosen?.id) {
        await this.conn.setSessionMode({ sessionId: s.sessionId, modeId: chosen.id });
      } else if (avail.length) {
        this.push({ type: "error", message: "⚠ Guardrail may not prompt: no permission-asking session mode was found — tool calls could run without the gate. Review carefully or restart the session." });
      }
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
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; } // a consumer is back
    this.emit = emit;
    for (const m of this.trace) emit(m);
  }
  detach(): void {
    if (this.killed) return;
    this.emit = () => {};
    // ADV-5: arm the idle grace — if nobody reattaches, the adapter is killed rather
    // than left orphaned. attach() cancels it; kill() clears it.
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => { this.idleTimer = null; this.kill(); this.onIdleClose(); }, 5 * 60_000);
  }

  kill(): void {
    if (this.killed) return;
    this.killed = true;
    this.emit = () => {};
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    // SEC-006: resolve any in-flight gate "ask"s to deny + drop their timers, so a
    // close mid-permission doesn't leave dangling promises/timeouts running for 3 min.
    const resolvers = [...this.pending.values()];
    this.pending.clear();
    for (const resolve of resolvers) resolve("deny");
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
    s.onIdleClose = () => { this.byId.delete(s.id); }; // ADV-5: drop on idle-close
    this.byId.set(s.id, s);
    try {
      await s.start();
    } catch (e) {
      // FEAS-3: a start() throw (auth/spawn failure) must not leave a zombie
      // adapter registered — kill the child + drop it before rethrowing, so a
      // failed create + the R5 retry path never leaks a subprocess.
      s.kill();
      this.byId.delete(s.id);
      throw e;
    }
    return s;
  }

  get(id: string): AcpSession | undefined {
    return this.byId.get(id);
  }

  /** Live session ids — the client reconciles its registry against this to prune
   *  ghost rows (a session dropped by a project switch / idle-close) (R11). */
  list(): string[] {
    return [...this.byId.keys()];
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

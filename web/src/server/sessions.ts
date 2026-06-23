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
import type { TermTransport } from "./transport.js";
import {
  ServerOp,
  FLOW_HIGH_WATER,
  FLOW_LOW_WATER,
  type SessionInfo,
  type SessionType,
} from "#shared/index.js";
import { encodeFrame } from "./frames.js";
import { buildInjection, cleanupInjection } from "./shell-integration/inject.js";
import { SessionRecording } from "./session-recording.js";
import { SessionCwd, parseOsc7 } from "./session-cwd.js";

const SCROLLBACK = 10_000;

function pickShell(): string {
  if (process.platform === "win32") return process.env.COMSPEC ?? "cmd.exe";
  return process.env.SHELL ?? (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
}

/** Options for non-default sessions (direct command spawn / agent lifecycle). */
export interface SessionSpawnOpts {
  /**
   * Spawn this program directly on the PTY instead of a shell: argv array,
   * never shell-interpreted, plain env (no rc injection / temp ZDOTDIR).
   * The caller (server) is responsible for allowlisting the command.
   */
  command?: string;
  args?: string[];
  type?: SessionType;
  /** host CLI name for agent sessions (display/bookkeeping only) */
  host?: string;
  /**
   * Inject the canonical session id instead of generating one. The server uses
   * this to open a git worktree with the SAME id BEFORE constructing the Session
   * (the PTY spawns synchronously in the worktree dir). Absent → random hex.
   */
  id?: string;
  /**
   * This agent runs inside its own daemon-owned git worktree (Wave B
   * concurrency). The close hook squash-merges via `session worktree close`
   * (from the main tree) instead of the in-place `session merge`.
   */
  sessionWorktree?: boolean;
  /**
   * Runs ONCE when an agent PTY exits (the zuzuu session-git merge); its
   * resolved value is stored as `closeResult` and surfaced over REST.
   */
  onClose?: (session: Session) => Promise<unknown>;
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
  readonly id: string;
  readonly createdAt = Date.now();
  /** true when this agent runs in its own git worktree (Wave B concurrency) */
  readonly usesWorktree: boolean;
  title: string;
  alive = true;
  readonly type: SessionType;
  readonly host: string | undefined;
  /** result of the agent-exit close hook (e.g. the session-git merge) */
  closeResult: unknown;
  private closeRan = false;
  private closeSettled: Promise<void> = Promise.resolve();
  private readonly pty: IPty;
  private readonly mirror: HeadlessTerminal;
  private readonly serializer = new SerializeAddon();
  private transport: TermTransport | null = null;
  private inflight = 0;
  private paused = false;
  private exitPayload: string | null = null;
  /** live cwd tracking (OSC 7 + poll fallback), composed not inlined */
  private cwdTracker!: SessionCwd;
  /** live working directory of the shell (absolute) — preserved public surface */
  get cwdAbs(): string {
    return this.cwdTracker.current();
  }
  private readonly tempDir: string | undefined;
  /** asciicast capture (output/resize ring + OSC 133 marks), composed not inlined */
  private readonly recorder = new SessionRecording(this.createdAt);
  /** true once the recording ring buffer has dropped events (preserved public surface) */
  get castTruncated(): boolean {
    return this.recorder.truncated;
  }

  constructor(
    readonly cwd: string,
    private readonly root: string,
    cols = 80,
    rows = 24,
    private readonly onUpdate: () => void,
    private readonly opts: SessionSpawnOpts = {},
  ) {
    this.id = opts.id ?? crypto.randomBytes(8).toString("hex");
    this.usesWorktree = opts.sessionWorktree === true;
    this.type = opts.type ?? "shell";
    this.host = opts.host;
    const file = opts.command ?? pickShell();
    this.title = file.split("/").pop() ?? file;
    this.mirror = new Terminal({ cols, rows, scrollback: SCROLLBACK, allowProposedApi: true });
    this.mirror.loadAddon(this.serializer);

    // OSC 7: the shell reports its real cwd instantly/exactly; this makes
    // the poll loop a fallback for shells where the hook didn't load.
    this.mirror.parser.registerOscHandler(7, (payload) => {
      this.cwdTracker.onOsc7(parseOsc7(payload));
      return true;
    });

    // OSC 133 C (command output begins): the shell-integration semantic-prompt
    // mark. Record a command-boundary marker so the saved recording gets a
    // navigable per-command chapter (Wave D, L5). Mirror-only (server-side
    // parse) — the client's own terminal/parser and the byte stream are
    // untouched. Returns true (handled); the raw bytes are still recorded +
    // streamed verbatim.
    this.mirror.parser.registerOscHandler(133, (payload) => {
      if (payload === "C" || payload.startsWith("C;")) this.recorder.mark();
      return true;
    });

    // Direct command sessions (agents) get NO shell and NO rc injection:
    // the argv is spawned as-is with a plain env, so nothing a host CLI
    // prints/parses is polluted by our shell-integration hook.
    const injection =
      opts.command || process.platform === "win32" ? null : buildInjection(file);
    this.tempDir = injection?.tempDir;
    const args =
      opts.command !== undefined
        ? opts.args ?? []
        : injection?.args ?? (process.platform === "win32" ? [] : ["-l"]);
    this.pty = pty.spawn(file, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        ...injection?.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        WEBCODE: "1",
        // The explicit join key (U4/KTD2): the daemon's PTY id is injected into
        // the host launch env so the host's SessionStart hook can record it onto
        // the durable trace record — linking PTY runtime <-> trace <-> git branch
        // by an explicit key rather than fragile cwd correlation. Set for all
        // sessions; agent sessions are the ones the hook actually fires for.
        ZUZUU_PTY_ID: this.id,
      },
    });

    this.cwdTracker = new SessionCwd({
      root: this.root,
      pid: this.pty.pid,
      initial: cwd,
      alive: () => this.alive,
      onChange: (payload) => {
        this.send(encodeFrame(ServerOp.Cwd, JSON.stringify(payload)));
        this.onUpdate();
      },
    });

    this.pty.onData((data) => {
      this.mirror.write(data);
      this.recorder.record("o", data);
      const proc = this.pty.process;
      if (proc && proc !== this.title) {
        this.title = proc;
        this.send(encodeFrame(ServerOp.Title, JSON.stringify({ title: this.title })));
        this.onUpdate();
      }
      if (this.transport) {
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
      this.runCloseHook();
      this.exitPayload = JSON.stringify({ exitCode, signal });
      this.send(encodeFrame(ServerOp.Exit, this.exitPayload));
      this.onUpdate();
    });
  }

  /** Agent exit → run the close hook (session-git merge) exactly once. */
  private runCloseHook(): void {
    const onClose = this.opts.onClose;
    if (this.type !== "agent" || !onClose || this.closeRan) return;
    this.closeRan = true;
    this.closeSettled = onClose(this).then(
      (result) => {
        this.closeResult = result;
      },
      () => {
        this.closeResult = { ok: false, stderr: "close hook failed" };
      },
    );
  }

  /** Resolves once any pending agent close hook has settled (immediately otherwise). */
  whenClosed(): Promise<void> {
    return this.closeSettled;
  }

  /** Single-attachment model: a new client takes over the session. */
  attach(transport: TermTransport): void {
    if (this.transport && this.transport !== transport) {
      this.transport.close(4000, "session attached elsewhere");
    }
    this.transport = transport;
    this.resetFlow();
    const snapshot = this.serializer.serialize({ scrollback: SCROLLBACK });
    transport.send(encodeFrame(ServerOp.Replay, snapshot));
    transport.send(encodeFrame(ServerOp.Cwd, JSON.stringify(this.cwdTracker.payload())));
    if (!this.alive && this.exitPayload) {
      transport.send(encodeFrame(ServerOp.Exit, this.exitPayload));
    }
    this.cwdTracker.start();
  }

  detach(transport: TermTransport): void {
    if (this.transport === transport) {
      this.transport = null;
      this.resetFlow();
      this.cwdTracker.stop();
    }
  }

  /** Serialize the captured session as asciicast v2 (NDJSON). */
  recording(): string {
    return this.recorder.toAsciicast({
      version: 2,
      width: this.pty.cols,
      height: this.pty.rows,
      timestamp: Math.floor(this.createdAt / 1000),
      title: `webcode — ${this.title}`,
      env: { SHELL: process.env.SHELL ?? "", TERM: "xterm-256color" },
    });
  }

  write(data: string): void {
    if (this.alive) this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    if (!Number.isInteger(cols) || !Number.isInteger(rows)) return;
    if (cols < 2 || rows < 1 || cols > 1000 || rows > 1000) return;
    this.mirror.resize(cols, rows);
    if (this.alive) this.pty.resize(cols, rows);
    this.recorder.record("r", `${cols}x${rows}`);
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
    if (this.transport?.isOpen) this.transport.send(frame);
  }

  kill(): void {
    this.cwdTracker.stop();
    this.transport?.close(1000, "session closed");
    this.transport = null;
    if (this.alive) {
      try {
        this.pty.kill();
      } catch {
        // already gone
      }
    }
    this.mirror.dispose();
    cleanupInjection(this.tempDir);
  }

  info(): SessionInfo {
    return {
      id: this.id,
      title: this.title,
      cwd: this.cwdAbs,
      alive: this.alive,
      createdAt: this.createdAt,
      type: this.type,
      ...(this.host !== undefined ? { host: this.host } : {}),
    };
  }
}

export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly defaultCwd: string = os.homedir()) {}

  create(cwd?: string, cols?: number, rows?: number, opts?: SessionSpawnOpts): Session {
    const session = new Session(cwd ?? this.defaultCwd, this.defaultCwd, cols, rows, () => {}, opts);
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

import fsp from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { WebSocketServer } from "ws";
import type { WorkspaceInfo } from "#shared/index.js";
import { SessionManager } from "./session-manager.js";
import { AuthGate } from "./auth.js";
import { createFsApi } from "./fs-api.js";
import { createZuzuuApi } from "./zuzuu-routes.js";
import { createProjectsApi } from "./projects-routes.js";
import { createSessionsApi } from "./sessions-routes.js";
import { createAgentCloser, type AgentCloser } from "./agent-close.js";
import { serveStatic } from "./static.js";
import { search } from "./search.js";
import { listFiles } from "./file-list.js";
import * as config from "./config.js";
import { attachTerm } from "./term-protocol.js";
import { WsTermTransport } from "./transport.js";
import { handleFsSocket } from "./ws-fs.js";
import { PathError, resolveSafe } from "./safe-path.js";

export interface ServerConfig {
  /** realpath'd absolute workspace root */
  root: string;
  port: number;
  host: string;
  token: string;
  /** absolute path to the built web UI (index.html + assets) */
  webDist: string;
  /** extra allowed origins, e.g. the Vite dev server */
  extraOrigins?: string[];
  version: string;
  /** running inside a per-user cloud sandbox VM */
  hosted?: boolean;
  /** public hostname the VM is reached at (e.g. "app.fly.dev") */
  publicHost?: string;
  /**
   * Commands POST /api/sessions may spawn directly (host coding-agent CLIs).
   * Injectable for tests; defaults to the fixed host allowlist.
   */
  commandAllowlist?: string[];
  /** zuzuu binary override (tests); defaults to "zuzuu" on PATH */
  zuzuuBinary?: string;
}

/** Host CLIs an agent/command session may run. Argv-spawned, never a shell. */
const DEFAULT_COMMAND_ALLOWLIST = ["claude", "gemini", "codex", "pi", "opencode", "zuzuu"];

export class WebcodeServer {
  readonly app: Hono;
  sessions: SessionManager;
  /** mutable workspace root — switchable at runtime via switchTo() */
  private root: string;
  private readonly startedAt = Date.now();
  private readonly auth: AuthGate;
  private readonly commandAllowlist: Set<string>;
  private server: ServerType | null = null;
  /** the agent-exit squash-merge orchestration (serializes worktree closes) */
  private readonly agentCloser: AgentCloser;

  constructor(private readonly cfg: ServerConfig) {
    this.root = cfg.root;
    this.commandAllowlist = new Set(cfg.commandAllowlist ?? DEFAULT_COMMAND_ALLOWLIST);
    this.agentCloser = createAgentCloser(() => this.root, cfg.zuzuuBinary);
    this.sessions = new SessionManager(cfg.root);
    this.auth = new AuthGate({
      port: cfg.port,
      token: cfg.token,
      ...(cfg.extraOrigins !== undefined ? { extraOrigins: cfg.extraOrigins } : {}),
      ...(cfg.publicHost !== undefined ? { publicHost: cfg.publicHost } : {}),
    });
    this.app = this.buildApp();
  }

  /**
   * Re-root the live daemon onto a new workspace. Tears down all terminal
   * sessions (like reloading an Obsidian vault) and rebuilds the manager;
   * fs watchers belong to client sockets and clean up when the client reloads.
   */
  async switchTo(newRoot: string): Promise<void> {
    const resolved = await fsp.realpath(path.resolve(newRoot));
    const st = await fsp.stat(resolved);
    if (!st.isDirectory()) throw new Error("not a directory");
    this.sessions.shutdown();
    this.sessions = new SessionManager(resolved);
    this.root = resolved;
    await config.addRecent(resolved);
  }

  // ── HTTP app ───────────────────────────────────────────────────────

  private buildApp(): Hono {
    const { cfg } = this;
    const app = new Hono();

    // security gates live in auth.ts: Host/Origin allowlists + token→cookie
    app.use("*", this.auth.gate());
    app.use("/api/*", this.auth.requireAuth());

    app.get("/api/workspace", (c) => {
      const body: WorkspaceInfo = {
        root: this.root,
        name: path.basename(this.root) || this.root,
        version: cfg.version,
      };
      return c.json(body);
    });

    app.route("/api/sessions", createSessionsApi({
      sessions: () => this.sessions,
      root: () => this.root,
      commandAllowlist: this.commandAllowlist,
      ...(cfg.zuzuuBinary !== undefined ? { zuzuuBinary: cfg.zuzuuBinary } : {}),
      closeAgentSession: (s) => this.agentCloser.close(s),
    }));

    app.get("/api/search", async (c) => {
      const query = c.req.query("q") ?? "";
      if (!query) return c.json({ error: "q required" }, 400);
      let searchRoot: string;
      try {
        searchRoot = await resolveSafe(this.root, c.req.query("path") ?? "");
      } catch (err) {
        if (err instanceof PathError) return c.json({ error: err.message }, 403);
        throw err;
      }
      const res = await search({
        query,
        searchRoot,
        root: this.root,
        regex: c.req.query("regex") === "1",
        caseSensitive: c.req.query("case") === "1",
      });
      return c.json(res);
    });

    app.get("/api/files", async (c) => {
      const limit = Math.min(Number(c.req.query("limit")) || 5000, 20000);
      return c.json(await listFiles(this.root, limit));
    });

    // ── health + workspace switch ──────────────────────────────────────
    app.get("/api/health", (c) =>
      c.json({
        ok: true,
        version: cfg.version,
        uptimeMs: Date.now() - this.startedAt,
        rss: process.memoryUsage().rss,
        root: this.root,
        name: path.basename(this.root) || this.root,
      }),
    );

    app.post("/api/workspace/switch", async (c) => {
      const { path: target } = await c.req.json<{ path: string }>();
      if (!target) return c.json({ error: "path required" }, 400);
      try {
        await this.switchTo(target);
      } catch (err) {
        return c.json({ error: (err as Error).message }, 400);
      }
      return c.json({ ok: true, root: this.root });
    });

    app.route("/api/fs", createFsApi(() => this.root));
    app.route("/api/zuzuu", createZuzuuApi(() => this.root, { binary: cfg.zuzuuBinary, liveSessions: () => this.sessions.list().length }));
    app.route("/api/projects", createProjectsApi(() => this.root)); // machine-global: recents + dir autocomplete

    // Static SPA (index.html fallback for client-side routes)
    app.get("*", serveStatic(cfg.webDist));

    return app;
  }

  // ── listen + WS upgrade ────────────────────────────────────────────

  start(onReady: (port: number) => void): void {
    const { cfg } = this;
    this.server = serve(
      { fetch: this.app.fetch, port: cfg.port, hostname: cfg.host },
      (info) => onReady(info.port),
    );

    const wss = new WebSocketServer({ noServer: true });

    this.server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const reject = (status: number, msg: string) => {
        socket.write(`HTTP/1.1 ${status} ${msg}\r\nConnection: close\r\n\r\n`);
        socket.destroy();
      };
      const allowed = this.auth.upgradeAllowed(req.headers);
      if (!allowed.ok) return reject(allowed.status, allowed.msg);

      const url = new URL(req.url ?? "/", "http://localhost");
      const termMatch = /^\/ws\/term\/([0-9a-f]+)$/.exec(url.pathname);
      if (termMatch) {
        const session = this.sessions.get(termMatch[1]!);
        if (!session) return reject(404, "Not Found");
        wss.handleUpgrade(req, socket, head, (ws) => attachTerm(new WsTermTransport(ws), session));
        return;
      }
      if (url.pathname === "/ws/fs") {
        wss.handleUpgrade(req, socket, head, (ws) => handleFsSocket(ws, this.root));
        // ^ this.root read at upgrade time → new connections (post-switch) use the new root
        return;
      }
      reject(404, "Not Found");
    });
  }

  stop(): void {
    this.sessions.shutdown();
    this.server?.close();
  }
}

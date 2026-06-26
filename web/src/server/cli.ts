// src/server/cli.ts — the `zz-web` bootstrap (run by bin/zz-web.js).
//
// Everything that turns a directory into a running daemon: arg parsing, the
// WEBCODE_HOSTED gate, the free-port scan, token persistence, the singleton
// instance file, and opening the browser. It composes the engine through
// createDaemon() (index.ts) — it owns orchestration, not HTTP. (Was the v1
// daemon/src/index.ts `main()`; paths re-rooted for the folded package.)

import fsp from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { createDaemon } from "./index.js";
import { addRecent, load as loadConfig } from "./config.js";
import { writeInstanceFile, removeInstanceFile, ensurePersistentToken } from "./instance-file.js";
import { resolveBundledCli, runZuzuu } from "./zuzuu-cli.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// The package root is two levels up whether running from src/server (tsx/dev) or
// dist/server (built): <pkg>/{src,dist}/server/cli → <pkg>.
const PKG_ROOT = path.resolve(HERE, "..", "..");
const DEFAULT_PORT = 7770;

interface CliArgs {
  dir: string;
  port: number;
  host: string;
  open: boolean;
  token: string | null;
  dev: boolean;
  /** explicit path to the zuzuu CLI this workbench shipped with (from `zz web`) */
  zuzuuBin: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dir: process.cwd(),
    port: DEFAULT_PORT,
    host: "127.0.0.1",
    open: true,
    token: null,
    dev: false,
    zuzuuBin: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "--port":
      case "-p":
        args.port = Number(argv[++i]);
        break;
      case "--host":
        args.host = argv[++i] ?? args.host;
        break;
      case "--no-open":
        args.open = false;
        break;
      case "--token":
        args.token = argv[++i] ?? null;
        break;
      case "--dev":
        args.dev = true;
        break;
      case "--zuzuu-bin":
        args.zuzuuBin = argv[++i] ?? null;
        break;
      case "--help":
      case "-h":
        console.log(`zz-web — the zuzuu visual workbench (terminal + files + the Project)

Usage: zz-web [dir] [options]

Options:
  -p, --port <n>   port to listen on (default ${DEFAULT_PORT}, scans up if busy)
      --host <h>   bind address (default 127.0.0.1 — do not expose without care)
      --no-open    don't open the browser
      --token <t>  fixed auth token (default: a persisted per-workspace token)
      --dev        allow the Vite dev server origin (development only)
  -h, --help       show this help`);
        process.exit(0);
        break;
      default:
        if (!a.startsWith("-")) args.dir = a;
    }
  }
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) {
    console.error(`invalid port`);
    process.exit(1);
  }
  return args;
}

function findFreePort(start: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number, left: number) => {
      const probe = net.createServer();
      probe.once("error", (err: NodeJS.ErrnoException) => {
        probe.close();
        if (err.code === "EADDRINUSE" && left > 0) tryPort(port + 1, left - 1);
        else reject(err);
      });
      probe.once("listening", () => probe.close(() => resolve(port)));
      probe.listen(port, host);
    };
    tryPort(start, 20);
  });
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // ── hosted mode (cloud sandbox) ────────────────────────────────────
  // Driven entirely by env so local behaviour is unchanged. In a per-user
  // micro-VM the VM boundary is the security model; we still keep the token +
  // Host/Origin gates, just widened to the public hostname.
  const hosted = process.env.WEBCODE_HOSTED === "1";
  if (hosted) {
    args.dir = process.env.WEBCODE_ROOT ?? args.dir;
    args.host = "0.0.0.0";
    args.port = Number(process.env.PORT) || 8080;
    args.token = process.env.WEBCODE_TOKEN ?? args.token;
    args.open = false;
  }

  let root: string;
  try {
    root = await fsp.realpath(path.resolve(args.dir));
  } catch {
    console.error(`zz-web: no such directory: ${args.dir}`);
    process.exit(1);
  }
  if (!hosted && args.host !== "127.0.0.1" && args.host !== "localhost" && args.host !== "::1") {
    console.error(
      "zz-web: refusing to bind a non-loopback address — the daemon exposes your filesystem and shell.\n" +
        "  (set WEBCODE_HOSTED=1 only inside an isolated per-user sandbox VM.)",
    );
    process.exit(1);
  }

  const pkg = JSON.parse(await fsp.readFile(path.join(PKG_ROOT, "package.json"), "utf8")) as { version: string };
  // Non-hosted: a STABLE per-workspace token (persisted under ~/.webcode), so
  // the browser's token-derived cookie keeps working across daemon restarts.
  // Explicit --token / hosted env still win. Hosted never persists.
  const token =
    args.token ?? (hosted ? crypto.randomBytes(24).toString("base64url") : ensurePersistentToken(root));
  if (!hosted) await addRecent(root).catch(() => {}); // remember this workspace
  const port = hosted ? args.port : await findFreePort(args.port, args.host);
  // The SPA assets: the client builds to <pkg>/dist/web (Vite). When it hasn't
  // been built yet the static handler degrades to a 404 — harmless for the CLI.
  const webDist = path.join(PKG_ROOT, "dist", "web");

  // The zuzuu CLI the daemon shells out to: prefer the one this workbench
  // SHIPPED with — an explicit --zuzuu-bin from `zz web` (authoritative), else
  // self-resolved relative to the daemon — over a stale PATH global.
  const zuzuuBinary = args.zuzuuBin || resolveBundledCli(HERE) || undefined;

  // Mandatory-local registry: on a local daemon, guarantee a registry exists and
  // pour the recents into it ONCE at boot (the bootstrap). `zz registry ensure`
  // creates a plain local registry at ~/.zuzuu/registry when none, seeds the given
  // paths (auto-tracked), and persists — so Projects Home always resolves to the
  // registry, not the ephemeral recents pass. Best-effort; never blocks startup.
  // (Live tracking thereafter is the session-open hook's registry.touch(), not a
  // per-request re-seed — so /list stays a pure read with no commit churn.)
  if (!hosted) {
    try {
      const cfg = await loadConfig();
      await runZuzuu(root, ["registry", "ensure", ...cfg.recent], { binary: zuzuuBinary });
    } catch { /* the registry is best-effort at boot */ }
  }

  const publicHost = process.env.WEBCODE_PUBLIC_HOST; // e.g. "myapp.fly.dev"
  const extraOrigins = [
    ...(args.dev ? ["http://localhost:5173", "http://127.0.0.1:5173"] : []),
    ...(publicHost ? [`https://${publicHost}`, `http://${publicHost}`] : []),
  ];

  const daemon = createDaemon({
    root,
    port,
    host: args.host,
    token,
    webDist,
    version: pkg.version,
    hosted,
    publicHost,
    extraOrigins: extraOrigins.length ? extraOrigins : undefined,
    zuzuuBinary,
  });

  daemon.listen((boundPort) => {
    const url = hosted
      ? `(hosted) listening on :${boundPort}`
      : `http://127.0.0.1:${boundPort}/?token=${token}`;
    console.log(`\n  zz-web v${pkg.version}`);
    console.log(`  workspace  ${root}`);
    console.log(`  url        ${url}\n`);
    // Singleton contract: record this instance so `zz web` can reuse it instead
    // of spawning a duplicate (never in hosted mode; never fatal).
    if (!hosted) {
      writeInstanceFile({
        root,
        port: boundPort,
        pid: process.pid,
        token,
        startedAt: new Date().toISOString(),
        version: pkg.version,
      });
    }
    if (args.open) openBrowser(url);
  });

  const shutdown = () => {
    if (!hosted) removeInstanceFile(root);
    daemon.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", () => {
    if (!hosted) removeInstanceFile(root); // best-effort; idempotent after shutdown()
  });
}

void main();

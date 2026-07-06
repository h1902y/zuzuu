// U5 (wake-source plan, docs/plans/2026-07-06-001-feat-wake-source-tick-plan.md)
// — the web daemon HOSTS the tick by shelling `zz tick --once` on a cadence,
// never by importing the engine. Covers: `--autonomy` off (default) registers
// no interval; on, an interval shells `tick --once` and is cleared by stop();
// the overlap guard skips a fire while the previous shell is still running;
// switchTo(newRoot) retargets subsequent ticks (no fire against a stale root);
// and the moat itself — no file under web/src imports the repo's top-level
// src/ (the engine).
//
// Timing note: spawning even a trivial shell stub can take several hundred ms
// to close/reap on a loaded machine — these tests poll (`waitFor`, the
// command-sessions.test.ts convention) rather than race fixed sleeps against
// that latency, so they stay robust across machines.
import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync, existsSync,
  realpathSync, readdirSync, statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebcodeServer } from "../../src/server/server.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // web/tests/server
const WEB_SRC = path.resolve(HERE, "../../src"); // web/src
const REPO_SRC = path.resolve(HERE, "../../../src"); // the repo's top-level engine src/

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitFor(cond: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await sleep(30);
  }
}

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function tmp(prefix: string): string {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  dirs.push(d);
  return d;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
  });
}

/** The calls a `logStub` has recorded so far — one array entry (cwd + argv,
 *  pipe-separated) per invocation. */
function readCalls(log: string): string[][] {
  if (!existsSync(log)) return [];
  return readFileSync(log, "utf8").trim().split("\n").filter(Boolean)
    .map((line) => line.split("|").filter((f) => f.length > 0));
}

/** A stub zuzuu binary that appends ONE line per invocation to `log`: the cwd
 *  it was spawned with (proves WHICH root a tick fired against — runZuzuuMut
 *  spawns with `cwd: root`), then its pipe-joined argv. `sleepMs` simulates a
 *  slow `zz tick` (for the overlap-guard test). Exits 0 with minimal JSON
 *  stdout so runZuzuuMut resolves `{ok:true}`. */
function logStub(dir: string, log: string, sleepMs = 0): string {
  const stub = path.join(dir, "zuzuu-log-stub.sh");
  writeFileSync(
    stub,
    `#!/bin/sh\nprintf '%s|' "$(pwd)" >> '${log}'\nfor a in "$@"; do printf '%s|' "$a" >> '${log}'; done\nprintf '\\n' >> '${log}'\n${sleepMs > 0 ? `sleep ${sleepMs / 1000}\n` : ""}echo '{}'\n`,
  );
  chmodSync(stub, 0o755);
  return stub;
}

async function withServer(
  cfg: Partial<{ autonomy: boolean; tickIntervalMs: number; zuzuuBinary: string; root: string }>,
): Promise<WebcodeServer> {
  const root = cfg.root ?? tmp("zw-tick-root-");
  const webDist = tmp("zw-tick-dist-");
  const port = await freePort();
  const server = new WebcodeServer({
    root, port, host: "127.0.0.1", token: "t", webDist, version: "0",
    ...(cfg.zuzuuBinary !== undefined ? { zuzuuBinary: cfg.zuzuuBinary } : {}),
    ...(cfg.autonomy !== undefined ? { autonomy: cfg.autonomy } : {}),
    ...(cfg.tickIntervalMs !== undefined ? { tickIntervalMs: cfg.tickIntervalMs } : {}),
  });
  await new Promise<void>((resolve) => server.start(() => resolve()));
  return server;
}

describe("WebcodeServer — the wake-source tick host (U5)", () => {
  it("--autonomy OFF (default) registers no interval — the CLI is never shelled", async () => {
    const logDir = tmp("zw-tick-off-log-");
    const log = path.join(logDir, "calls.log");
    const stub = logStub(logDir, log);
    // autonomy left unset → defaults to OFF regardless of a short tickIntervalMs
    const server = await withServer({ zuzuuBinary: stub, tickIntervalMs: 30 });
    await sleep(1200); // generously longer than a real spawn+reap round trip
    server.stop();
    expect(existsSync(log)).toBe(false);
  }, 15_000);

  it("--autonomy ON shells `zz tick --once` on the interval; stop() clears it", async () => {
    const logDir = tmp("zw-tick-on-log-");
    const log = path.join(logDir, "calls.log");
    const stub = logStub(logDir, log);
    // a cadence longer than a single shell round-trip so we can cleanly observe
    // "one fire completed" before the NEXT one is even scheduled.
    const server = await withServer({ zuzuuBinary: stub, autonomy: true, tickIntervalMs: 700 });

    await waitFor(() => readCalls(log).length >= 1);
    const calls = readCalls(log);
    for (const fields of calls) {
      expect(fields).toContain("tick");
      expect(fields).toContain("--once");
    }

    const countAtStop = readCalls(log).length;
    server.stop(); // well before the next 700ms cadence — no further fire should ever start
    await sleep(1500); // long enough to have caught a fire had stop() NOT cleared the interval
    expect(readCalls(log).length).toBe(countAtStop);
  }, 15_000);

  it("the overlap guard skips a fire while the previous shell hasn't resolved", async () => {
    const logDir = tmp("zw-tick-overlap-log-");
    const log = path.join(logDir, "calls.log");
    const stub = logStub(logDir, log, 500); // each shell simulates ~500ms of work
    // cadence (50ms) is far shorter than the shell's runtime — without the
    // overlap guard this would attempt ~20+ spawns over the wait window below.
    const server = await withServer({ zuzuuBinary: stub, autonomy: true, tickIntervalMs: 50 });

    await waitFor(() => readCalls(log).length >= 1); // first invocation completes
    await sleep(1200); // room for at most a couple more REAL completions
    server.stop();

    const invocations = readCalls(log).length;
    expect(invocations).toBeGreaterThanOrEqual(1);
    expect(invocations).toBeLessThanOrEqual(5); // bounded — proves fires don't pile up
  }, 15_000);

  it("switchTo(newRoot) retargets subsequent ticks — no fire against the stale root", async () => {
    const rootA = tmp("zw-tick-root-a-");
    const rootB = tmp("zw-tick-root-b-");
    const logDir = tmp("zw-tick-switch-log-");
    const log = path.join(logDir, "calls.log");
    const stub = logStub(logDir, log);
    const server = await withServer({ root: rootA, zuzuuBinary: stub, autonomy: true, tickIntervalMs: 200 });

    // let at least one tick fire and complete against rootA
    await waitFor(() => readCalls(log).some(([cwd]) => cwd === rootA));
    await server.switchTo(rootB);
    // a SUBSEQUENT tick must now target rootB
    await waitFor(() => readCalls(log).some(([cwd]) => cwd === rootB));
    server.stop();

    const roots = readCalls(log).map(([cwd]) => cwd ?? "");
    expect(roots).toContain(rootA);
    expect(roots).toContain(rootB);
    // every fire from the first rootB sighting onward must stay on rootB —
    // never reverts to the stale root.
    const firstB = roots.indexOf(rootB);
    expect(roots.slice(firstB).every((r) => r === rootB)).toBe(true);
  }, 15_000);
});

describe("moat: web/ never imports src/ (the engine) — it only shells `zz`", () => {
  function listSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) out.push(...listSourceFiles(p));
      else if (/\.(ts|tsx|mts|cts)$/.test(entry)) out.push(p);
    }
    return out;
  }

  it("no file under web/src has a relative import that resolves into the repo's src/", () => {
    const specRe = /\bfrom\s+["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)|\bimport\(\s*["']([^"']+)["']\s*\)/g;
    const offenders: string[] = [];
    for (const file of listSourceFiles(WEB_SRC)) {
      const text = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = specRe.exec(text))) {
        const spec = m[1] ?? m[2] ?? m[3] ?? "";
        if (!spec.startsWith(".")) continue; // only a relative import can escape the package
        const resolved = path.resolve(path.dirname(file), spec);
        const rel = path.relative(REPO_SRC, resolved);
        if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) {
          offenders.push(`${path.relative(WEB_SRC, file)} → "${spec}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("server.ts hosts the tick by shelling zuzuu-cli.js's runZuzuuMut, not by importing grow/", () => {
    const text = readFileSync(path.join(WEB_SRC, "server", "server.ts"), "utf8");
    expect(text).toMatch(/runZuzuuMut/);
    expect(text).not.toMatch(/from\s+["'].*\/src\/grow/);
  });
});

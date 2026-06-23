// src/server/session-cwd.ts — one job: track the session's live working directory.
//
// Two sources, OSC 7 preferred: the shell-integration hook reports cwd exactly via
// OSC 7 (onOsc7), which also disables the poll fallback; absent that, a poll loop
// reads the PTY process's cwd shell-agnostically. On a change it fires the injected
// onChange hook — the Session wires that to a Cwd frame + an update, so this module
// never touches the transport or the flow-control hot path.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CwdPayload } from "#shared/index.js";
import { toRel } from "./safe-path.js";

const execFileAsync = promisify(execFile);
const CWD_POLL_MS = 2_500;

/** Resolve the live working directory of a process, shell-agnostically. */
export async function processCwd(pid: number): Promise<string | null> {
  try {
    if (process.platform === "linux") {
      const { stdout } = await execFileAsync("readlink", [`/proc/${pid}/cwd`], { timeout: 1000 });
      return stdout.trim() || null;
    }
    // darwin: -Fn prints "p<pid>" then "n<path>" lines
    const { stdout } = await execFileAsync(
      "lsof",
      ["-a", "-p", String(pid), "-d", "cwd", "-Fn"],
      { timeout: 2000 },
    );
    const line = stdout.split("\n").find((l) => l.startsWith("n"));
    return line ? line.slice(1) : null;
  } catch {
    return null;
  }
}

/** Parse an OSC 7 payload `file://host/path` into a decoded absolute path. */
export function parseOsc7(payload: string): string | null {
  const m = /^file:\/\/[^/]*(\/.*)$/.exec(payload);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return m[1]!;
  }
}

export interface SessionCwdOpts {
  /** the served workspace root (for workspace-relative payloads) */
  root: string;
  /** the PTY process id (for the poll fallback) */
  pid: number;
  /** the session's starting cwd */
  initial: string;
  /** whether the session is still alive (poll stops once it isn't) */
  alive: () => boolean;
  /** fired on every cwd change with the wire payload */
  onChange: (payload: CwdPayload) => void;
}

export class SessionCwd {
  private abs: string;
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  /** true once OSC 7 has reported cwd — the poll fallback then stays off */
  private oscSeen = false;

  constructor(private readonly o: SessionCwdOpts) {
    this.abs = o.initial;
  }

  /** the live absolute cwd */
  current(): string {
    return this.abs;
  }

  /** the wire payload (workspace-relative unless outside the root) */
  payload(): CwdPayload {
    const { root } = this.o;
    const inside = this.abs === root || this.abs.startsWith(root + "/");
    return inside ? { cwd: toRel(root, this.abs) } : { cwd: this.abs, outside: true };
  }

  /** OSC 7 reported a cwd — exact, and it disables the poll fallback. */
  onOsc7(dir: string | null): void {
    if (!dir) return;
    this.oscSeen = true;
    this.stop();
    if (dir !== this.abs) {
      this.abs = dir;
      this.o.onChange(this.payload());
    }
  }

  /** Start the poll fallback (no-op if OSC 7 already fired or already polling). */
  start(): void {
    if (this.timer || !this.o.alive() || this.oscSeen) return;
    this.timer = setInterval(() => {
      if (this.polling) return;
      this.polling = true;
      void processCwd(this.o.pid)
        .then((dir) => {
          if (dir && dir !== this.abs) {
            this.abs = dir;
            this.o.onChange(this.payload());
          }
        })
        .finally(() => {
          this.polling = false;
        });
    }, CWD_POLL_MS);
  }

  /** Stop the poll fallback. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

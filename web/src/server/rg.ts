// src/server/rg.ts — "is ripgrep on PATH?", probed once and memoized.
//
// Both search.ts (content search) and file-list.ts (the ⌘K file list) prefer
// `rg` and fall back to a manual walk. They shared a byte-identical probe +
// cache; this is the one source of truth so cold start probes `rg --version`
// exactly once instead of twice.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

let rgAvailable: boolean | null = null;

/** True if `rg` is callable; result cached for the process lifetime. */
export async function hasRg(): Promise<boolean> {
  if (rgAvailable === null) {
    rgAvailable = await execFileAsync("rg", ["--version"], { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
  }
  return rgAvailable;
}

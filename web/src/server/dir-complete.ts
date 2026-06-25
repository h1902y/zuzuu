// src/server/dir-complete.ts — names-only directory autocomplete for "Open a
// folder…" (R17). THE ONE DELIBERATE OUT-OF-JAIL SURFACE (D5): you are picking a
// folder you have not opened yet, so this cannot go through the per-root safe-path
// realpath jail like every other fs read. It is therefore deliberately narrow:
//   • directory NAMES only — never file contents, never recursion
//   • permission/ENOENT/not-a-dir errors → empty list (never throws, never
//     traverses into unreadable dirs)
//   • a hard result cap
// The daemon binds 127.0.0.1 + token auth, so this is reachable only by the local
// authenticated user browsing their own filesystem.

import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { DirListing } from "#shared/index.js";

const MAX_RESULTS = 50;

/** Split a typed prefix into the directory to list + the partial name to filter by.
 *  Expands a leading ~ to $HOME; a trailing separator means "list this dir". Pure. */
export function splitPrefix(prefix: string): { baseDir: string; partial: string } {
  let p = prefix.trim();
  if (p === "~") p = os.homedir();
  else if (p.startsWith("~/")) p = path.join(os.homedir(), p.slice(2));
  if (p === "") return { baseDir: os.homedir(), partial: "" };
  if (p.endsWith(path.sep)) return { baseDir: p.slice(0, -1) || path.sep, partial: "" };
  return { baseDir: path.dirname(p), partial: path.basename(p) };
}

/** List child directory NAMES under the typed prefix (filtered by the partial).
 *  Any error → empty list; never throws. */
export async function listDirs(prefix: string): Promise<DirListing> {
  const { baseDir, partial } = splitPrefix(prefix);
  let dirs: string[] = [];
  try {
    const entries = await readdir(baseDir, { withFileTypes: true });
    dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((n) => n.startsWith(partial))
      .sort()
      .slice(0, MAX_RESULTS);
  } catch {
    dirs = []; // ENOENT / EACCES / ENOTDIR → empty, never throw
  }
  return { prefix, dirs };
}

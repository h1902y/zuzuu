// src/server/project-health.ts — read a Project's health from disk WITHOUT running
// its daemon (the cross-project Projects Home reads every recent this way). Stat the
// .zuzuu home: real modules (dirs with a module.md), notes (items/*.md), pending
// proposals (staged/*), guardrail presence, and last-activity (newest mtime). All
// fs reads are best-effort — a missing/unreadable path degrades to zeros, never throws.
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { resolveHomeSync } from "./zuzuu-peek.js";

export interface ProjectHealth {
  modules: number;
  notes: number;
  pending: number;
  guarded: boolean;
  /** newest mtime under .zuzuu (ms epoch), 0 when unknown. */
  lastActivityMs: number;
}

const EMPTY: ProjectHealth = { modules: 0, notes: 0, pending: 0, guarded: false, lastActivityMs: 0 };

function countDir(dir: string, ext?: string): number {
  try {
    return readdirSync(dir).filter((f) => (ext ? f.endsWith(ext) : true) && !f.startsWith(".")).length;
  } catch { return 0; }
}

function mtimeMs(p: string): number {
  try { return statSync(p).mtimeMs; } catch { return 0; }
}

/** Read a Project's health from its home (best-effort; never throws). Root-mode
 *  aware: modules live at the repo root when the `project.md` marker is present
 *  (the flagship vault used to read as 0 modules here — the launcher offered
 *  "Create the brain" over hundreds of notes). Staged proposals live under
 *  `.zuzuu/<module>/staged` in BOTH modes (ephemera never move to the root). */
export function readProjectHealth(root: string): ProjectHealth {
  const home = resolveHomeSync(root);
  if (!existsSync(home)) return EMPTY;
  let entries: string[];
  try { entries = readdirSync(home); } catch { return EMPTY; }

  const ephemera = path.join(root, ".zuzuu");
  let modules = 0, notes = 0, pending = 0, guarded = false, last = mtimeMs(home);
  for (const name of entries) {
    if (name.startsWith(".")) continue; // root-mode: never walk .git/.zuzuu/.claude as modules
    const dir = path.join(home, name);
    let st; try { st = statSync(dir); } catch { continue; }
    if (!st.isDirectory()) continue;
    if (!existsSync(path.join(dir, "module.md"))) continue; // only real (grown) modules
    modules++;
    if (name === "instructions" || name === "guardrails") guarded = true; // the enforced safety floor (instructions = new default, guardrails = legacy)
    notes += countDir(path.join(dir, "items"), ".md");
    pending += countDir(path.join(ephemera, name, "staged"));
    last = Math.max(last, mtimeMs(dir));
  }
  return { modules, notes, pending, guarded, lastActivityMs: last };
}

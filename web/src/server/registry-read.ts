// src/server/registry-read.ts — the daemon's view of the active project registry.
//
// The Projects Home reads the durable registry when one is configured, else falls
// back to ~/.webcode recents (the fallback ladder). The registry is machine-global,
// so we read it via the bundled CLI (`zz registry status --json`) — the same engine
// the CLI tests pin. The mapping + the ladder are pure (unit-tested); only the shell
// read is side-effecting. Best-effort: a missing/absent registry degrades to recents.

import path from "node:path";
import type { ProjectSummary } from "#shared/index.js";
import { runZuzuu } from "./zuzuu-cli.js";
import { readProjectHealth } from "./project-health.js";

interface HealthStamp {
  modules: number; notes: number; pending: number; guarded: boolean; lastActivityMs: number;
}
export interface RegistryRef {
  id: string;
  handle?: string;
  remote?: string;
  path?: string;
  tracked?: "auto" | "pinned";
  groups?: string[];
  portable?: boolean;
  health?: HealthStamp;
}
export interface RegistryStatus {
  configured: boolean;
  identity?: string | null;
  projects?: number;
  refs?: RegistryRef[];
}

const EMPTY_HEALTH: HealthStamp = { modules: 0, notes: 0, pending: 0, guarded: false, lastActivityMs: 0 };

/** Map a registry project-ref → a Projects Home row. Refreshes health from cold disk
 *  when the project is present locally; otherwise uses the committed stamp (so a
 *  cloned-elsewhere registry still renders its list). */
export function refToSummary(ref: RegistryRef, root: string): ProjectSummary {
  const p = ref.path ?? "";
  const live = p ? readProjectHealth(p) : null;
  const h = live && live.lastActivityMs ? live : (ref.health ?? EMPTY_HEALTH);
  return {
    path: p,
    name: ref.handle ?? ref.id ?? (p ? path.basename(p) : "project"),
    current: !!p && p === root,
    source: "registry",
    modules: h.modules, notes: h.notes, pending: h.pending, guarded: h.guarded, lastActivityMs: h.lastActivityMs,
    groups: ref.groups ?? [],
    tracked: ref.tracked ?? "auto",
    remote: ref.remote,
    portable: ref.portable ?? !!ref.remote,
  };
}

/** The fallback ladder: a configured registry with refs wins; else the recents pass. */
export function chooseSource(
  registry: RegistryStatus | null,
  recents: string[],
  root: string,
): { source: "registry" | "recents"; projects: ProjectSummary[] } {
  if (registry?.configured && registry.refs && registry.refs.length) {
    return { source: "registry", projects: registry.refs.map((r) => refToSummary(r, root)) };
  }
  return {
    source: "recents",
    projects: recents.map((p) => ({
      path: p, name: path.basename(p) || p, current: p === root, source: "recents" as const,
      ...readProjectHealth(p),
    })),
  };
}

/** Read the active registry via the bundled CLI. null when none configured / CLI absent. */
export async function readRegistry(root: string, run = runZuzuu): Promise<RegistryStatus | null> {
  const out = await run(root, ["registry", "status", "--json"]).catch(() => null);
  if (!out || typeof out !== "object") return null;
  const s = out as RegistryStatus;
  return s.configured ? s : null;
}

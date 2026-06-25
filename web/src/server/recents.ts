// src/server/recents.ts — the pure recents reconciler for the switcher (R10, R16).
//
// Maps the persisted `~/.webcode/config.json` recents (most-recent-first paths)
// into picker rows, deduped and order-preserved, with the daemon's current root
// marked. No instance-file reconciliation: the in-place switch model means there
// is one daemon, so "running vs idle" collapses to "current vs recent".

import path from "node:path";
import type { RecentProject } from "#shared/index.js";

export function reconcileRecents(recent: string[], currentRoot: string): RecentProject[] {
  const seen = new Set<string>();
  const rows: RecentProject[] = [];
  for (const p of recent) {
    if (seen.has(p)) continue;
    seen.add(p);
    rows.push({ path: p, name: path.basename(p) || p, current: p === currentRoot });
  }
  return rows;
}

// src/client/panel/dashboard-data.ts — pure shaping for the modules dashboard.
//
// Turns the daemon's /api/zuzuu/overview into the tile view-models the grid
// renders. Pure + testable — no React, no fetch.

import type { ModuleOverviewResponse } from "#shared/index.js";

export interface Tile {
  key: string;
  title: string;
  tagline: string;
  items: number;
  pending: number;
  errors: number;
  enabled: boolean;
}

export function toTiles(overview: ModuleOverviewResponse): Tile[] {
  return overview.modules.map((m) => ({
    key: m.id,
    title: m.title || m.id,
    tagline: m.tagline ?? "",
    items: m.counts.items,
    pending: m.counts.pending,
    errors: m.counts.errors,
    enabled: m.enabled ?? true,
  }));
}

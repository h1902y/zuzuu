// src/client/panel/dashboard-data.ts — pure shaping for the modules dashboard.
//
// Turns the daemon's /api/zuzuu/overview into the tile view-models the grid
// renders, with sensible icon/accent fallbacks for the five built-ins. Pure +
// testable — no React, no fetch.

import type { ModuleOverviewResponse } from "#shared/index.js";

export interface Tile {
  key: string;
  title: string;
  tagline: string;
  icon: string;
  accent: string;
  items: number;
  pending: number;
  errors: number;
  top: string[];
  enabled: boolean;
}

/** Icon/accent fallbacks when the manifest's `ui` block is absent (CLI degraded). */
const FALLBACK: Record<string, { icon: string; accent: string }> = {
  knowledge: { icon: "book", accent: "info" },
  memory: { icon: "clock", accent: "neutral" },
  actions: { icon: "play", accent: "success" },
  instructions: { icon: "compass", accent: "warning" },
  guardrails: { icon: "shield", accent: "danger" },
};

export function toTiles(overview: ModuleOverviewResponse): Tile[] {
  return overview.modules.map((m) => {
    const fb = FALLBACK[m.id] ?? { icon: "box", accent: "neutral" };
    return {
      key: m.id,
      title: m.title || m.id,
      tagline: m.tagline ?? "",
      icon: m.ui?.icon ?? fb.icon,
      accent: m.ui?.accent ?? fb.accent,
      items: m.counts.items,
      pending: m.counts.pending,
      errors: m.counts.errors,
      top: m.top ?? [],
      enabled: m.enabled ?? true,
    };
  });
}

/** Total pending proposals across the brain (the dashboard's headline number). */
export function totalPending(overview: ModuleOverviewResponse): number {
  return overview.modules.reduce((n, m) => n + m.counts.pending, 0);
}

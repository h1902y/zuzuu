// shell/projects/globe-model.ts — the GLOBAL page's pure model (§F).
//
// The launcher retires: GLOBAL is the same page grammar as a project — a canvas of
// nodes + the omnibar — where THE NODES ARE PROJECTS. Fidelity pin (the tier
// doctrine): cross-project is a ROLL-UP + registry read, never a merged master
// Project — the globe AGGREGATES a view; each project keeps its own gate/generations.
//
// Rendering choice (documented): the two-level force ENGINE (world.ts) models
// modules-as-islands + notes-as-dots + affinity links — a structure projects don't
// have (no islands, no links, no note bodies). Rather than fork the engine or fake a
// degenerate single "projects" module (whose meta-physics, rings, chips, ghosts,
// spotlight, and mini-cards would all be dead weight or misleading), the globe is a
// small deterministic constellation that SHARES the engine's visual language (dots
// sized by note count, the same FNV hue, the dark canvas) without its physics. ~N
// nodes need no simulation. moduleHue is reused so a project's color is stable.

import type { ProjectSummary } from "#shared/index.js";
import { moduleHue } from "../../world/model.js";

export interface GlobeNode {
  path: string;
  name: string;
  emoji: string;
  notes: number;
  modules: number;
  pending: number;
  guarded: boolean;
  current: boolean;
  lastActivityMs: number;
  /** placed position + radius (view coordinates) */
  x: number;
  y: number;
  r: number;
  /** stable color (FNV hue over the path) */
  color: string;
}

/** A project's color — the same stable FNV hue the world palette uses, keyed on the
 *  path so it's identity-stable across renders and machines. */
export function projectColor(path: string): string {
  return `hsl(${moduleHue(path)} 58% 60%)`;
}

/**
 * Place the projects as a center-out sunflower constellation (biggest/most-recent
 * near the center), radius ∝ √notes. Deterministic + pure — no physics needed for a
 * handful of nodes; the layout is a function of the sorted set + the viewport.
 */
export function globeNodes(projects: readonly ProjectSummary[], size: { w: number; h: number }): GlobeNode[] {
  const sorted = [...projects].sort((a, b) => b.notes - a.notes || b.lastActivityMs - a.lastActivityMs);
  const cx = size.w / 2;
  const cy = size.h / 2;
  const golden = Math.PI * (3 - Math.sqrt(5)); // the golden angle → an even spiral
  const step = Math.min(size.w, size.h) / (Math.max(5, sorted.length) * 1.5);
  return sorted.map((p, i) => {
    const radius = step * Math.sqrt(i) * 1.7;
    const a = i * golden;
    const r = Math.min(46, 15 + Math.sqrt(p.notes) * 3);
    return {
      path: p.path, name: p.name, emoji: p.emoji, notes: p.notes, modules: p.modules,
      pending: p.pending, guarded: p.guarded, current: p.current, lastActivityMs: p.lastActivityMs,
      x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, r, color: projectColor(p.path),
    };
  });
}

export interface GlobalGreeting {
  salutation: string;
  /** one calm roll-up line — needs-me across projects, or all-caught-up */
  brief: string;
  /** the projects that need you, most-pending first (for suggested rows) */
  needy: { path: string; name: string; pending: number }[];
}

/**
 * The global greeting (§E.4, rolled up ACROSS projects): "3 projects need you — N to
 * review". needs-me here is the review count per project (the recents/list payload's
 * `pending`); held sessions aren't in the machine-global list, so this is an honest
 * review roll-up, not the full composite. Pure (hour injected).
 */
export function globalGreeting(projects: readonly ProjectSummary[], hour: number): GlobalGreeting {
  const needy = projects
    .filter((p) => p.pending > 0)
    .map((p) => ({ path: p.path, name: p.name, pending: p.pending }))
    .sort((a, b) => b.pending - a.pending);
  const total = needy.reduce((n, p) => n + p.pending, 0);
  const part = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const brief = total > 0
    ? `${needy.length} project${needy.length === 1 ? "" : "s"} need you — ${total} to review`
    : `${projects.length} project${projects.length === 1 ? "" : "s"} · all caught up`;
  return { salutation: part, brief, needy };
}

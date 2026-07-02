// src/client/lib/module-details.ts — merges N `GET /module/:key` responses
// (ModuleDetail) into one flat item list + one flat staged list. Both the
// omnibar's fan-out (PaletteBody's Notes/Views/Proposals sources) and the
// "see all results" content view (Search.tsx) do this exact fold; it used to
// live inline as `.flatMap(d => d.items)` / `.flatMap(d => d.staged.map(...))`
// at each call site, TRUSTING that every response carries real `items`/`staged`
// arrays. `ModuleDetail` promises that (see #shared/zuzuu.ts) and the daemon's
// read route holds it today — but a client-side fold that trusts a network
// response's shape without defending it is exactly the class of bug that
// blanked the "see all results" view: `d.staged.map(...)` threw immediately
// the moment any ONE module-detail response arrived without `staged` (a
// degraded/peek/CLI-failure edge), and the throw happened inside a React
// render path with nothing to catch it. Guarded here, once, so every caller
// gets the defense for free regardless of what the server currently promises.
import type { ModuleDetail, ModuleItem, StagedSummary } from "#shared/index.js";

export interface MergedModuleDetails {
  items: ModuleItem[];
  staged: { module: string; s: StagedSummary }[];
}

/** Fold module-detail responses into `{items, staged}`. Each response degrades
 *  independently and silently: `null`/`undefined` (a missing fan-out slot),
 *  a non-array `items`, or a non-array `staged` all contribute nothing rather
 *  than throwing — a blank screen must be structurally impossible here. */
export function mergeModuleDetails(details: readonly (ModuleDetail | null | undefined)[]): MergedModuleDetails {
  const items: ModuleItem[] = [];
  const staged: { module: string; s: StagedSummary }[] = [];
  for (const d of details) {
    if (!d) continue;
    if (Array.isArray(d.items)) items.push(...d.items);
    if (Array.isArray(d.staged)) for (const s of d.staged) staged.push({ module: d.key, s });
  }
  return { items, staged };
}

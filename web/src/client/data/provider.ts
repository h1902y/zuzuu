// data/provider.ts — the DataProvider: one backend-agnostic seam every Brain surface
// is built against (Refine's model). Composes over lib/api.ts (the daemon → gated zz CLI).
//
// THE INVERSION (the review gate as data-provider semantics): create/update DO NOT
// return a landed row — they resolve to a PENDING StagedChange. The row appears in the
// Review queue and lands only on approve. The gate falls out of the contract, not bolted on.
//
// A factory (makeDataProvider) takes the zuzuu api so it's unit-testable with a mock;
// the default binds the real client. Pure logic here; surfaces stay thin.
import { api } from "../lib/api.js";
import type { ModuleItem, StagedChange, StagedSummary } from "#shared/index.js";

type ZuzuuApi = typeof api.zuzuu;

/** Client-side filter state (the filter-chip bar drives this; server-side index
 *  filtering is a later enhancement — the /module/:key route takes no params yet). */
export interface FilterState { text?: string; kind?: string }

export interface ListResult {
  items: ModuleItem[];
  /** total before filtering */
  total: number;
  staged: StagedSummary[];
  degraded?: boolean;
}

const matches = (it: ModuleItem, f: FilterState): boolean => {
  if (f.kind && it.kind !== f.kind) return false;
  if (f.text) {
    const q = f.text.toLowerCase();
    if (!(`${it.title ?? ""} ${it.body ?? ""} ${it.id}`.toLowerCase().includes(q))) return false;
  }
  return true;
};

export function makeDataProvider(zuzuu: ZuzuuApi = api.zuzuu) {
  return {
    /** getList — a module's notes, with the staged queue + a degraded flag. */
    async getList(module: string, filter: FilterState = {}): Promise<ListResult> {
      const detail = await zuzuu.module(module);
      const items = detail.items.filter((it) => matches(it, filter));
      return { items, total: detail.items.length, staged: detail.staged, degraded: detail.degraded };
    },

    /** getOne — a single record. */
    getOne: (module: string, id: string): Promise<ModuleItem> => zuzuu.item(module, id),

    /** getMany — batched over getList (no batch route on the daemon yet → no N+1). */
    async getMany(module: string, ids: string[]): Promise<ModuleItem[]> {
      const want = new Set(ids);
      const detail = await zuzuu.module(module);
      return detail.items.filter((it) => want.has(it.id));
    },

    // ── writes resolve to a PENDING proposal, never a landed row (the gate) ──
    create: (module: string, target: string, change: Record<string, unknown>): Promise<StagedChange> =>
      zuzuu.stage(module, { op: "create", target, change }),
    update: (module: string, target: string, change: Record<string, unknown>): Promise<StagedChange> =>
      zuzuu.stage(module, { op: "update", target, change }),

    // ── the gate (approve lands it; reject teaches via a reason) ──
    approve: (id: string, module: string) => zuzuu.approve(id, module),
    reject: (id: string, module: string, reason?: string) => zuzuu.reject(id, module, reason),
  };
}

export type DataProvider = ReturnType<typeof makeDataProvider>;
export const dataProvider: DataProvider = makeDataProvider();

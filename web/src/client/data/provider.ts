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
import type { ListQuery } from "./list-state.js";

type ZuzuuApi = typeof api.zuzuu;

/** A relation edge: relate adds it, unrelate prunes it (the `link` FieldType's write). */
export interface RelationChange { from: string; type: string; to: string }

export interface ListResult {
  /** ONE page of the module's notes (the server already filtered·sorted·sliced). */
  items: ModuleItem[];
  /** the pre-paginate match count — the client paginates off this. */
  total: number;
  staged: StagedSummary[];
  degraded?: boolean;
}

/** The list control state → the server module-query (Rung 7). `kind` is the note
 *  type filter (kind → --type); sort + the page window become limit/offset. The index
 *  does the filter·sort·paginate — NO more `limit:10000` + a client-side `matches()`. */
const toModuleQuery = (q: ListQuery) => ({
  ...(q.text ? { text: q.text } : {}),
  ...(q.kind ? { type: q.kind } : {}),
  ...(q.sort ? { sort: `${q.sort.key}${q.sort.dir === "desc" ? ":desc" : ""}` } : {}),
  limit: q.pageSize,
  offset: q.page * q.pageSize,
});

export function makeDataProvider(zuzuu: ZuzuuApi = api.zuzuu) {
  return {
    /** getList — one server-filtered·sorted·paginated page + the staged queue + total. */
    async getList(module: string, query: ListQuery): Promise<ListResult> {
      const detail = await zuzuu.module(module, toModuleQuery(query));
      return {
        items: detail.items,
        total: detail.total ?? detail.items.length,
        staged: detail.staged,
        degraded: detail.degraded,
      };
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
    // Every row op inherits THE INVERSION cleanly: create/update/delete/deprecate target
    // a note by id; relate/unrelate carry a relation EDGE ({from,type,to}) — the `link`
    // FieldType writes through these. None ever writes a row directly; all stage a proposal.
    create: (module: string, target: string, change: Record<string, unknown>): Promise<StagedChange> =>
      zuzuu.stage(module, { op: "create", target, change }),
    update: (module: string, target: string, change: Record<string, unknown>): Promise<StagedChange> =>
      zuzuu.stage(module, { op: "update", target, change }),
    remove: (module: string, target: string): Promise<StagedChange> =>
      zuzuu.stage(module, { op: "delete", target }),
    deprecate: (module: string, target: string): Promise<StagedChange> =>
      zuzuu.stage(module, { op: "deprecate", target }),
    relate: (module: string, change: RelationChange): Promise<StagedChange> =>
      zuzuu.stage(module, { op: "relate", change: { ...change } }),
    unrelate: (module: string, change: RelationChange): Promise<StagedChange> =>
      zuzuu.stage(module, { op: "unrelate", change: { ...change } }),

    // ── the gate (approve lands it; reject teaches via a reason) ──
    approve: (id: string, module: string) => zuzuu.approve(id, module),
    reject: (id: string, module: string, reason?: string) => zuzuu.reject(id, module, reason),
  };
}

export type DataProvider = ReturnType<typeof makeDataProvider>;
export const dataProvider: DataProvider = makeDataProvider();

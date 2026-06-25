// shell/review/use-review-queue.ts — load the cross-module proposal queue and the
// gate actions. Fetches each pending module's staged summaries, aggregates + groups
// via the review-model core, and exposes approve/reject (→ evolve / teach) with a
// refetch. Thin glue over the DataProvider; the aggregation logic is tested.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { StagedSummary } from "#shared/index.js";
import { api } from "../../lib/api.js";
import { dataProvider } from "../../data/provider.js";
import { toast } from "../../state/toast.js";
import { aggregateStaged, groupBy } from "./review-model.js";

/** Fetch the staged summaries of every module that has pending proposals. */
async function loadQueue(): Promise<Record<string, StagedSummary[]>> {
  const ov = await api.zuzuu.overview();
  const pending = ov.modules.filter((m) => (m.counts?.pending ?? 0) > 0);
  const details = await Promise.all(pending.map((m) => api.zuzuu.module(m.id)));
  const byModule: Record<string, StagedSummary[]> = {};
  for (const d of details) byModule[d.key] = d.staged;
  return byModule;
}

export function useReviewQueue() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["zuzuu", "review-queue"], queryFn: loadQueue });
  const queue = aggregateStaged(q.data ?? {});
  const grouped = groupBy(queue, "module");
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["zuzuu"] }); // queue + overview + project-state

  const approve = async (id: string, module: string) => {
    try { await dataProvider.approve(id, module); }
    catch { toast("Couldn’t approve", "error"); }
    finally { invalidate(); }
  };
  const reject = async (id: string, module: string, reason: string) => {
    try { await dataProvider.reject(id, module, reason); }
    catch { toast("Couldn’t reject", "error"); }
    finally { invalidate(); }
  };

  return { grouped, total: queue.length, loading: q.isLoading, approve, reject };
}

// shell/review/use-review-queue.ts — load the cross-module proposal queue and the
// gate actions. Fetches each pending module's staged summaries, aggregates + scores +
// sorts (U4: confidence × blast-radius — destructive/low-confidence float to the top,
// replacing the old flat first-seen order) + groups via the review-model core, and
// exposes approve/reject (→ evolve / teach) with a refetch. Thin glue over the
// DataProvider; the aggregation/scoring logic is tested.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { StagedSummary } from "#shared/index.js";
import { api } from "../../lib/api.js";
import { dataProvider } from "../../data/provider.js";
import { toast } from "../../state/toast.js";
import { aggregateStaged, groupBy, scoreQueue, sortByScore } from "./review-model.js";

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
  // U4: score (confidence × blast-radius) then sort HIGHEST-attention first, BEFORE
  // grouping — so both the flat `queue` and each module's bucket in `grouped` read
  // destructive/low-confidence-first, batchable-tail-last (was flat first-seen order).
  const queue = sortByScore(scoreQueue(aggregateStaged(q.data ?? {})));
  const grouped = groupBy(queue, "module");
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["zuzuu"] }); // queue + overview + project-state

  // Surface the gate's PRECISE refusal (audit item 4): the CLI says exactly what's
  // wrong ("field 'company' is required") and the ApiError now carries it — the
  // generic "Couldn't approve" left users stuck with a poison proposal.
  const why = (e: unknown) => (e instanceof Error && e.message ? ` — ${e.message}` : "");
  const approve = async (id: string, module: string) => {
    try { await dataProvider.approve(id, module); }
    catch (e) { toast(`Couldn’t approve${why(e)}`, "error"); }
    finally { invalidate(); }
  };
  const reject = async (id: string, module: string, reason: string) => {
    try { await dataProvider.reject(id, module, reason); }
    catch (e) { toast(`Couldn’t reject${why(e)}`, "error"); }
    finally { invalidate(); }
  };

  return { queue, grouped, total: queue.length, loading: q.isLoading, approve, reject };
}

// shell/review/use-review-queue.ts — load the cross-module proposal queue and the
// gate actions. Fetches each pending module's staged summaries, aggregates + scores +
// sorts (U4: confidence × blast-radius — destructive/low-confidence float to the top,
// replacing the old flat first-seen order) + groups via the review-model core, and
// exposes approve/reject (→ evolve / teach) with a refetch. Thin glue over the
// DataProvider; the aggregation/scoring logic is tested.
//
// U6 — `axis` picks the grouping view (module | session/run, default "module" for
// existing callers like World.tsx). It is NOT part of the react-query key: switching
// axis only re-runs the pure `groupByAxis` partition over the already-fetched,
// already-scored `queue` on the next render — no refetch, no cache invalidation.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { StagedSummary } from "#shared/index.js";
import { api } from "../../lib/api.js";
import { dataProvider } from "../../data/provider.js";
import { toast } from "../../state/toast.js";
import { aggregateStaged, groupByAxis, scoreQueue, sortByScore } from "./review-model.js";
import type { GroupAxis } from "./review-model.js";
import type { EditIntent } from "./review-flow.js";

/** Fetch the staged summaries of every module that has pending proposals. */
async function loadQueue(): Promise<Record<string, StagedSummary[]>> {
  const ov = await api.zuzuu.overview();
  const pending = ov.modules.filter((m) => (m.counts?.pending ?? 0) > 0);
  const details = await Promise.all(pending.map((m) => api.zuzuu.module(m.id)));
  const byModule: Record<string, StagedSummary[]> = {};
  for (const d of details) byModule[d.key] = d.staged;
  return byModule;
}

export function useReviewQueue(axis: GroupAxis = "module") {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["zuzuu", "review-queue"], queryFn: loadQueue });
  // U4: score (confidence × blast-radius) then sort HIGHEST-attention first, BEFORE
  // grouping — so both the flat `queue` and each bucket in `grouped` read
  // destructive/low-confidence-first, batchable-tail-last (was flat first-seen order).
  const queue = sortByScore(scoreQueue(aggregateStaged(q.data ?? {})));
  // U6: `groupByAxis` only re-partitions this same sorted `queue` — no query re-run,
  // so toggling `axis` between renders never refetches (see file header).
  const grouped = groupByAxis(queue, axis);
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

  // U5 edit-before-approve — the honest two-op fallback (review-flow.ts's editIntent
  // documents the FLAGGED GAP: the daemon's approve route takes no field override, so
  // there's no one-shot "land the edited version" today). Composes the two EXISTING
  // gate ops instead of inventing a new landing path (KTD5): reject the stale
  // proposal, then re-stage the edits as a FRESH create/update. The re-staged
  // proposal re-enters the queue PENDING — it is never auto-approved (KTD4 holds).
  const restage = async (intent: EditIntent) => {
    const target = intent.restage.target;
    if (!target) { toast("Couldn’t re-stage the edit — no target id", "error"); return; }
    try {
      await dataProvider.reject(intent.reject.id, intent.reject.module, intent.reject.reason);
      await (intent.restage.op === "update"
        ? dataProvider.update(intent.restage.module, target, intent.restage.change)
        : dataProvider.create(intent.restage.module, target, intent.restage.change));
    } catch (e) { toast(`Couldn’t re-stage the edit${why(e)}`, "error"); }
    finally { invalidate(); }
  };

  return { queue, grouped, total: queue.length, loading: q.isLoading, approve, reject, restage };
}

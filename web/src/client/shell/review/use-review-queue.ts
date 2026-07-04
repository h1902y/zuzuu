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
  // generic "Couldn't approve" left users stuck with a poison proposal. `why` reads
  // EITHER a thrown Error's message OR a plain string reason (`softError` below) —
  // one formatter for both failure shapes.
  const why = (e: unknown) => {
    if (e instanceof Error && e.message) return ` — ${e.message}`;
    if (typeof e === "string" && e.trim()) return ` — ${e.trim()}`;
    return "";
  };
  // Bug fix (the stuck "landing…" card): the daemon can resolve the approve/reject
  // fetch with HTTP 200 and a body of `{ok:false, error}` — a refused mutation that
  // never throws (review.mjs returns `{ok:false, error}` on a validation refusal; the
  // route only answers non-2xx when the CLI ITSELF fails to run, a separate bug being
  // fixed outside this pass). `approve`/`reject` used to trust `res.ok` (HTTP) alone
  // and treat this as a silent success — no toast, no signal back to ProposalCard, so
  // its local `landing` flag never cleared. This reads the RESOLVED body's own `ok`
  // too (structural — ApproveResult/RejectResult don't declare `error` in the shared
  // type, but the wire payload carries one on refusal) and now returns a `boolean` the
  // caller can act on (ProposalCard's clearsLanding; the batch model's runBatchApprove).
  const softError = (r: { ok: boolean }): string | undefined => {
    const e = (r as { error?: unknown }).error;
    return typeof e === "string" && e.trim() ? e.trim() : undefined;
  };
  const approve = async (id: string, module: string): Promise<boolean> => {
    try {
      const r = await dataProvider.approve(id, module);
      if (!r.ok) { toast(`Couldn’t approve${why(softError(r))}`, "error"); return false; }
      return true;
    } catch (e) { toast(`Couldn’t approve${why(e)}`, "error"); return false; }
    finally { invalidate(); }
  };
  const reject = async (id: string, module: string, reason: string): Promise<boolean> => {
    try {
      const r = await dataProvider.reject(id, module, reason);
      if (!r.ok) { toast(`Couldn’t reject${why(softError(r))}`, "error"); return false; }
      return true;
    } catch (e) { toast(`Couldn’t reject${why(e)}`, "error"); return false; }
    finally { invalidate(); }
  };

  // U5 edit-before-approve — the honest two-op fallback (review-flow.ts's editIntent
  // documents the FLAGGED GAP: the daemon's approve route takes no field override, so
  // there's no one-shot "land the edited version" today). Composes the two EXISTING
  // gate ops instead of inventing a new landing path (KTD5): reject the stale
  // proposal, then re-stage the edits as a FRESH create/update. The re-staged
  // proposal re-enters the queue PENDING — it is never auto-approved (KTD4 holds).
  const restage = async (intent: EditIntent): Promise<boolean> => {
    const target = intent.restage.target;
    if (!target) { toast("Couldn’t re-stage the edit — no target id", "error"); return false; }
    try {
      const r = await dataProvider.reject(intent.reject.id, intent.reject.module, intent.reject.reason);
      if (!r.ok) { toast(`Couldn’t re-stage the edit${why(softError(r))}`, "error"); return false; }
      await (intent.restage.op === "update"
        ? dataProvider.update(intent.restage.module, target, intent.restage.change)
        : dataProvider.create(intent.restage.module, target, intent.restage.change));
      return true;
    } catch (e) { toast(`Couldn’t re-stage the edit${why(e)}`, "error"); return false; }
    finally { invalidate(); }
  };

  return { queue, grouped, total: queue.length, loading: q.isLoading, approve, reject, restage };
}

// shell/review/ReviewQueue.tsx — the unified cross-session proposal queue (the gate).
// Pending proposals grouped by module; each a ProposalCard. Rendered both in the
// session wing and in the global review overlay (the R key / the ribbon). Calm
// "all caught up" empty state. Static utilities only.
import { useReviewQueue } from "./use-review-queue.js";
import { Check } from "lucide-react";
import { ProposalCard } from "./ProposalCard.js";
import { Stack, Inline, Text, Icon } from "../../ds/index.js";

export function ReviewQueue() {
  const { grouped, total, loading, approve, reject } = useReviewQueue();

  if (loading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  if (!total) return <div className="grid h-full place-items-center"><Inline gap="xs"><Icon icon={Check} size={14} /><Text tone="muted">all caught up</Text></Inline></div>;

  return (
    <div className="h-full overflow-y-auto p-4">
      <Stack gap="md">
        <Text size="meta" tone="subtle" weight="semibold">REVIEW · {total} pending</Text>
        {Object.entries(grouped).map(([module, items]) => (
          <Stack key={module} gap="sm">
            <Text size="meta" tone="muted">{module}</Text>
            {items.map((it) => (
              <ProposalCard key={it.id} item={it} onApprove={approve} onReject={reject} />
            ))}
          </Stack>
        ))}
      </Stack>
    </div>
  );
}

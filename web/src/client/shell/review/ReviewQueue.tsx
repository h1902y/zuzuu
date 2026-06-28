// shell/review/ReviewQueue.tsx — the unified cross-session proposal queue (the gate).
// Pending proposals grouped by module; each a ProposalCard. Rendered in the session
// wing AND the global review overlay. The overlay passes `keyboard` for the focused
// decision flow (P2.4): j/k (↓/↑) move the cursor, a/Enter approves the focused
// proposal — fast triage. Calm "all caught up" empty state. Static utilities only.
import { useEffect, useState } from "react";
import { useReviewQueue } from "./use-review-queue.js";
import { clampFocus, moveFocus, focusedId } from "./review-flow.js";
import { Check } from "lucide-react";
import { ProposalCard } from "./ProposalCard.js";
import { emptyCopy } from "../empty-copy.js";
import { Stack, Inline, Text, EmptyState } from "../../ds/index.js";

export function ReviewQueue({ keyboard }: { keyboard?: boolean } = {}) {
  const { queue, grouped, total, loading, approve, reject } = useReviewQueue();
  const [focus, setFocus] = useState(0);
  const [decided, setDecided] = useState(0);
  const [diffOpenId, setDiffOpenId] = useState<string | null>(null);

  const focusIdx = clampFocus(total, focus);
  const focusId = keyboard ? focusedId(queue, focusIdx) : null;

  // the focused decision flow — only the overlay binds keys (avoids the wing instance
  // double-firing). Ignores keystrokes while typing; approve targets the focused card.
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setFocus((f) => moveFocus(total, clampFocus(total, f), 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setFocus((f) => moveFocus(total, clampFocus(total, f), -1)); }
      else if (e.key === "a" || e.key === "Enter") {
        const target = queue.find((q) => q.id === focusedId(queue, clampFocus(total, focus)));
        if (target) { e.preventDefault(); setDecided((n) => n + 1); approve(target.id, target.module); }
      }
      else if (e.key === "d") {
        const id = focusedId(queue, clampFocus(total, focus));
        if (id) { e.preventDefault(); setDiffOpenId((cur) => (cur === id ? null : id)); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard, total, focus, queue, approve]);

  if (loading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  if (!total) {
    const copy = emptyCopy("review");
    return <EmptyState icon={Check} title={copy.title} hint={decided ? `${decided} reviewed this round. ${copy.hint}` : copy.hint} />;
  }

  const rejectAndCount = (id: string, module: string, reason: string) => { setDecided((n) => n + 1); reject(id, module, reason); };

  return (
    <div className="h-full overflow-y-auto p-6">
      <Stack gap="md">
        <Inline gap="sm" justify="between">
          <Text size="meta" tone="subtle" weight="semibold">REVIEW · {total} pending</Text>
          {keyboard && <Text size="meta" tone="muted">j/k move · a approve · d diff</Text>}
        </Inline>
        {Object.entries(grouped).map(([module, items]) => (
          <Stack key={module} gap="sm">
            <Text size="meta" tone="muted">{module}</Text>
            {items.map((it) => (
              <ProposalCard
                key={it.id}
                item={it}
                focused={it.id === focusId}
                {...(keyboard ? { diffOpen: it.id === diffOpenId, onDiffOpenChange: (o: boolean) => setDiffOpenId(o ? it.id : null) } : {})}
                onApprove={approve}
                onReject={rejectAndCount}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </div>
  );
}

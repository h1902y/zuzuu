// shell/Ribbon.tsx — the always-on footer ribbon: the ambient gate (R5). Live-session
// count + total pending + R-to-review; a calm "✓ all caught up" empty state. Composed
// from ds primitives; the layout frame uses static utilities (no inline styles / arbitrary values).
import { ribbonState, type SessionLite } from "./shell-state.js";
import { Inline, Text } from "../ds/index.js";

export function Ribbon({
  sessions, pendingByModule, onReview,
}: { sessions: SessionLite[]; pendingByModule: Record<string, number>; onReview: () => void }) {
  const r = ribbonState(sessions, pendingByModule);
  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-app px-3">
      <Inline gap="sm">
        <Text size="meta" tone={r.liveness ? "accent" : "muted"}>
          {r.liveness ? `● ${r.liveness} live` : "○ idle"}
        </Text>
        <Text size="meta" tone="muted">·</Text>
        <Text size="meta" tone={r.pending ? "default" : "muted"}>
          {r.allCaughtUp ? "✓ all caught up" : `◷ ${r.pending} pending`}
        </Text>
      </Inline>
      {!r.allCaughtUp && (
        <Text as="button" size="meta" tone="accent" onClick={onReview}>
          press R to review
        </Text>
      )}
    </div>
  );
}

// shell/review/SessionCloseCard.tsx — the "what this session taught" card (U5/R5).
//
// A PERSISTENT toast (no auto-dismiss): when an agent session ends with staged
// proposals, it surfaces at the reflective moment showing the count-by-type + the top
// mined patterns (reason lines), with "Review now" (opens the gate) and a dismiss.
// Thin: the detection/dedup + the derivations live in session-close-card.ts; this
// only composes ds primitives (static, token-bound — no inline styles / arbitrary
// values, ds-no-inline-safe).
import { X } from "lucide-react";
import { Box, Stack, Inline, Text, Button, Chip, Icon } from "../../ds/index.js";
import { useSessionClose } from "../../state/session-close.js";
import { useReview } from "../../state/review.js";
import { countByType, topPatterns } from "./session-close-card.js";

export function SessionCloseCard() {
  const card = useSessionClose((s) => s.card);
  const dismiss = useSessionClose((s) => s.dismiss);
  const setReview = useReview((s) => s.setOpen);
  if (!card) return null;

  const counts = countByType(card.staged);
  const patterns = topPatterns(card.staged, 3);
  const review = () => { dismiss(); setReview(true); };

  return (
    <div className="fixed bottom-10 right-4 z-50 w-80">
      <Box bg="elevated" border="hairline" radius="ui" pad="md">
        <Stack gap="sm">
          <Inline gap="md" justify="between" align="start">
            <Text size="ui" weight="semibold">What this session taught</Text>
            <Text as="button" interactive tone="muted" onClick={dismiss}><Icon icon={X} size={13} /></Text>
          </Inline>

          <Inline gap="xs" wrap>
            {counts.map((c) => (
              <Inline key={c.label} gap="xs">
                <Chip label={c.label} />
                <Text size="meta" tone="muted">{c.count}</Text>
              </Inline>
            ))}
          </Inline>

          {patterns.length > 0 && (
            <Stack gap="xs">
              {patterns.map((p) => (
                <Text key={p.id} size="meta" tone="muted" truncate>{p.reason}</Text>
              ))}
            </Stack>
          )}

          <Inline gap="sm">
            <Button variant="primary" size="sm" onClick={review}>Review now</Button>
            <Button variant="ghost" size="sm" onClick={dismiss}>Later</Button>
          </Inline>
        </Stack>
      </Box>
    </div>
  );
}

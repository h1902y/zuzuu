// shell/review/ProposalCard.tsx — one staged proposal at the gate. Approve lands it
// (→ evolve); Reject opens the reason taxonomy (the gate that teaches). Composes ds
// primitives + the kit Button.
import { useState } from "react";
import type { StagedSummary } from "#shared/index.js";
import { REJECT_REASONS } from "./review-model.js";
import { Box, Stack, Inline, Text, Button } from "../../ds/index.js";

export function ProposalCard({ item, onApprove, onReject }: {
  item: StagedSummary;
  onApprove: (id: string, module: string) => void;
  onReject: (id: string, module: string, reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  return (
    <Box border="hairline" radius="ui" pad="sm" bg="surface">
      <Stack gap="xs">
        <Text size="ui" weight="medium">{item.title}</Text>
        {item.preview && <Text size="meta" tone="muted">{item.preview}</Text>}
        <Text size="meta" tone="muted">{item.module}{item.confidence ? ` · ${item.confidence}` : ""}</Text>
        {!rejecting ? (
          <Inline gap="sm">
            <Button variant="primary" size="sm" onClick={() => onApprove(item.id, item.module)}>Approve</Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(true)}>Reject</Button>
          </Inline>
        ) : (
          <Inline gap="xs" wrap>
            {REJECT_REASONS.map((r) => (
              <Button key={r} variant="outline" size="sm" onClick={() => { onReject(item.id, item.module, r); setRejecting(false); }}>{r}</Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>cancel</Button>
          </Inline>
        )}
      </Stack>
    </Box>
  );
}

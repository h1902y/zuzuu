// shell/review/ProposalCard.tsx — one staged proposal at the gate. Approve lands it
// (→ evolve); Reject opens the reason taxonomy (the gate that teaches). When `focused`
// (the keyboard decision flow, P2.4) the card rings + scrolls into view. Composes ds
// primitives + the kit Button.
import { useEffect, useRef, useState } from "react";
import type { StagedSummary } from "#shared/index.js";
import { REJECT_REASONS } from "./review-model.js";
import { reasonLine } from "./reason-line.js";
import { proposalChip } from "./proposal-chip.js";
import { provenanceOf } from "./provenance.js";
import { DiffPreview } from "./DiffPreview.js";
import { Stack, Inline, Text, Button, Chip } from "../../ds/index.js";

export function ProposalCard({ item, focused, diffOpen, onDiffOpenChange, onApprove, onReject }: {
  item: StagedSummary;
  focused?: boolean;
  /** when set, the diff pane is parent-controlled (so the queue's `d` shortcut can
   *  toggle the focused card); otherwise the card owns its own diff-open state. */
  diffOpen?: boolean;
  onDiffOpenChange?: (open: boolean) => void;
  onApprove: (id: string, module: string) => void;
  onReject: (id: string, module: string, reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [selfDiffOpen, setSelfDiffOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // The diff pane is parent-controlled when `diffOpen` is supplied (the queue's `d`
  // shortcut drives the focused card); otherwise the card owns it locally.
  const controlled = diffOpen !== undefined;
  const isDiffOpen = controlled ? diffOpen : selfDiffOpen;
  const setDiffOpen = controlled ? (onDiffOpenChange ?? (() => {})) : setSelfDiffOpen;

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <div
      ref={ref}
      className={`rounded-ui border bg-surface p-2 transition-colors ${focused ? "border-accent ring-1 ring-inset ring-focus" : "border-border"}`}
    >
      <Stack gap="xs">
        <Inline gap="sm" align="center">
          {(() => { const c = proposalChip(item.change?.type, item.module); return <Chip label={c.label} tone={c.tone} />; })()}
          <Text size="ui" weight="medium" truncate>{item.title}</Text>
        </Inline>
        <Text size="meta" tone="muted">{reasonLine(item.evidence?.[0]?.kind, item.evidence)}</Text>
        {item.preview && <Text size="meta" tone="muted">{item.preview}</Text>}
        {item.confidence && <Text size="meta" tone="muted">{item.confidence}</Text>}
        {(() => {
          // Provenance (U6 / R6): name the session(s) this proposal was born from —
          // the session↔proposal cross-reference. Degrades silently when no source.
          const prov = provenanceOf(item.source);
          if (!prov) return null;
          return (
            <Inline gap="xs" wrap align="center">
              <Text size="meta" tone="subtle">{prov.label}</Text>
              {prov.display.map((s, i) => <Chip key={prov.sessions[i] ?? s} label={s} tone="neutral" />)}
            </Inline>
          );
        })()}
        <DiffPreview item={item} open={isDiffOpen} onOpenChange={setDiffOpen} />
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
    </div>
  );
}

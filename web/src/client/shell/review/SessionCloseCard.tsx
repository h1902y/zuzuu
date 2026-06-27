// shell/review/SessionCloseCard.tsx — the session-end review card (U5 brain + U6 code).
//
// A PERSISTENT toast (no auto-dismiss) at the reflective moment a session ends. It now
// surfaces ONE review for the whole session: the CODE section (the held branch's diff
// summary + Merge / Keep on branch / Discard) ABOVE the brain section (the mined
// proposals — type chips, reason lines, "Review now"). It fires for code-only sessions
// too. Thin: the fire/derivation/merge-state logic lives in session-close-card.ts; this
// composes ds primitives (token-bound utility classes only — no inline styles / arbitrary
// values, ds-no-inline-safe).
import { useReducer, useState } from "react";
import { X } from "lucide-react";
import { Box, Stack, Inline, Text, Button, Chip, Icon } from "../../ds/index.js";
import { useSessionClose } from "../../state/session-close.js";
import { useReview } from "../../state/review.js";
import { api, ApiError } from "../../lib/api.js";
import {
  countByType,
  topPatterns,
  markCloseCardDeferred,
  mergeReducer,
  initialMergeState,
  type CloseCardCode,
} from "./session-close-card.js";

export function SessionCloseCard() {
  const card = useSessionClose((s) => s.card);
  const dismiss = useSessionClose((s) => s.dismiss);
  const resolveCode = useSessionClose((s) => s.resolveCode);
  const setReview = useReview((s) => s.setOpen);
  const [merge, dispatch] = useReducer(mergeReducer, initialMergeState);
  const [showDiff, setShowDiff] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  if (!card) return null;

  const code = card.code;
  const counts = countByType(card.staged);
  const patterns = topPatterns(card.staged, 3);
  const hasBrain = counts.length > 0;
  const busy = merge.phase === "merging";
  const review = () => { dismiss(); setReview(true); };

  /** Run a held-session action (merge/discard) under the busy-lock; on success the
   *  code section collapses (resolveCode → brain-only, or the card clears). Never
   *  silent — a failure lands an inline error and the card stays for a retry. */
  const runAction = async (action: (id: string) => Promise<unknown>) => {
    if (!code) return;
    dispatch({ type: "start" });
    try {
      await action(code.id);
      dispatch({ type: "ok" });
      resolveCode();
    } catch (e) {
      dispatch({ type: "fail", error: e instanceof ApiError ? e.message : "couldn't complete — try again" });
    }
  };

  const keep = () => { markCloseCardDeferred(card.sessionId); resolveCode(); };

  return (
    <div className={`fixed bottom-10 right-4 z-50 ${code ? "w-96" : "w-80"}`}>
      <Box bg="elevated" border="hairline" radius="ui" pad="md">
        <Stack gap="sm">
          <Inline gap="md" justify="between" align="start">
            <Text size="ui" weight="semibold">{code ? "Session review" : "What this session taught"}</Text>
            <Text as="button" interactive tone="muted" onClick={dismiss}><Icon icon={X} size={13} /></Text>
          </Inline>

          {code && (
            <CodeSection
              code={code}
              busy={busy}
              error={merge.phase === "error" ? merge.error : undefined}
              showDiff={showDiff}
              confirmDiscard={confirmDiscard}
              onMerge={() => void runAction(api.mergeHeld)}
              onKeep={keep}
              onToggleDiff={() => setShowDiff((v) => !v)}
              onAskDiscard={() => setConfirmDiscard(true)}
              onCancelDiscard={() => setConfirmDiscard(false)}
              onConfirmDiscard={() => { setConfirmDiscard(false); void runAction(api.discardHeld); }}
            />
          )}

          {code && hasBrain && <div className="border-t border-border" />}

          {hasBrain && (
            <Stack gap="sm">
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
          )}
        </Stack>
      </Box>
    </div>
  );
}

/** The CODE section: the held branch's diff summary + the Merge / Keep / Discard gate.
 *  A `conflict` mergeability disables Merge with a note (the Resolve affordance is U8).
 *  Discard is an inline confirm (not a stacked dialog). Pure presentation — all state
 *  lives in the parent. */
function CodeSection({
  code, busy, error, showDiff, confirmDiscard,
  onMerge, onKeep, onToggleDiff, onAskDiscard, onCancelDiscard, onConfirmDiscard,
}: {
  code: CloseCardCode;
  busy: boolean;
  error?: string;
  showDiff: boolean;
  confirmDiscard: boolean;
  onMerge: () => void;
  onKeep: () => void;
  onToggleDiff: () => void;
  onAskDiscard: () => void;
  onCancelDiscard: () => void;
  onConfirmDiscard: () => void;
}) {
  const conflict = code.mergeability === "conflict";
  const files = `${code.files} file${code.files === 1 ? "" : "s"}`;
  const checkpoints = `${code.checkpoints} checkpoint${code.checkpoints === 1 ? "" : "s"}`;

  return (
    <Stack gap="sm">
      <Inline gap="sm" wrap>
        <Text size="meta" tone="subtle" weight="semibold">CODE</Text>
        <Text size="meta" tone="muted">{files}</Text>
        <Text size="meta" tone="accent">+{code.added}</Text>
        <Text size="meta" tone="danger">−{code.removed}</Text>
        <Text size="meta" tone="muted">{checkpoints}</Text>
        <Text as="button" interactive size="meta" tone="muted" onClick={onToggleDiff}>
          {showDiff ? "Hide" : "View diff"}
        </Text>
      </Inline>

      {showDiff && (
        <Box bg="app" border="hairline" radius="ui" pad="sm">
          <Stack gap="xs">
            <Text size="meta" tone="muted" truncate>branch {code.branch}</Text>
            <Text size="meta" tone="muted">{files} · +{code.added} / −{code.removed} · {checkpoints}</Text>
            <Text size="meta" tone="muted">mergeability: {code.mergeability}</Text>
          </Stack>
        </Box>
      )}

      {conflict && (
        <Text size="meta" tone="danger">conflict — resolve needed before this can merge</Text>
      )}
      {error && <Text size="meta" tone="danger">{error}</Text>}

      {confirmDiscard ? (
        <Stack gap="xs">
          <Text size="meta" tone="muted">Drop branch + all checkpoints? Can&rsquo;t be undone.</Text>
          <Inline gap="sm">
            <Button variant="danger" size="sm" onClick={onConfirmDiscard} disabled={busy}>Discard</Button>
            <Button variant="ghost" size="sm" onClick={onCancelDiscard} disabled={busy}>Cancel</Button>
          </Inline>
        </Stack>
      ) : (
        <Inline gap="sm">
          <Button variant="primary" size="sm" onClick={onMerge} disabled={busy || conflict}>
            {busy ? "Merging…" : "Merge"}
          </Button>
          <Button variant="outline" size="sm" onClick={onKeep} disabled={busy}>Keep on branch</Button>
          <Button variant="danger" size="sm" onClick={onAskDiscard} disabled={busy}>Discard</Button>
        </Inline>
      )}
    </Stack>
  );
}

// shell/review/ProposalCard.tsx — one staged proposal at the gate. Approve lands it
// (→ evolve); Reject opens the reason taxonomy (the gate that teaches); since U5, Edit
// opens an inline amend-then-re-stage form, and a checkbox joins the batch-selection
// set. When `focused` (the keyboard decision flow, P2.4) the card rings + scrolls into
// view. Composes ds primitives + the kit Button.
import { useEffect, useRef, useState } from "react";
import type { StagedSummary } from "#shared/index.js";
import { REJECT_REASONS } from "./review-model.js";
import { isUpdate } from "./diff.js";
import { reasonLine } from "./reason-line.js";
import { proposalChip } from "./proposal-chip.js";
import { provenanceOf } from "./provenance.js";
import { DiffPreview } from "./DiffPreview.js";
import { ConfidenceMeter } from "./ConfidenceMeter.js";
import { Stack, Inline, Text, Button, Chip, ProposalBadge } from "../../ds/index.js";

const editInput = "w-full rounded-ui border border-border bg-app px-2 py-1 text-meta text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim";

export function ProposalCard({
  item, focused, diffOpen, onDiffOpenChange,
  rejectOpen, reasonIndex, onRejectOpenChange,
  editOpen, onEditOpenChange, onEdit,
  selected, onToggleSelect,
  onApprove, onReject,
}: {
  item: StagedSummary;
  focused?: boolean;
  /** when set, the diff pane is parent-controlled (so the queue's `d` shortcut can
   *  toggle the focused card); otherwise the card owns its own diff-open state. */
  diffOpen?: boolean;
  onDiffOpenChange?: (open: boolean) => void;
  /** U5 — when supplied (the keyboard-hot queue's `r`), the reject taxonomy is
   *  parent-controlled: `reasonIndex` is the keyboard-highlighted reason (arrows/j/k
   *  move it, Enter/a digit submits — review-flow.ts's reject-taxonomy model) and
   *  `onRejectOpenChange` drives BOTH the keyboard gesture and a mouse click here (so
   *  clicking Reject on any card in a keyboard-hot queue routes through the same
   *  single-open-at-a-time state). Omitted in mouse-only contexts, where Reject/cancel
   *  fall back to the card's own local open/close state, unaffected. */
  rejectOpen?: boolean;
  reasonIndex?: number;
  onRejectOpenChange?: (open: boolean) => void;
  /** U5 edit-before-approve — the same controlled/uncontrolled split as diffOpen: an
   *  "Edit" button always works locally (mouse); the keyboard `e` gesture additionally
   *  parent-controls it for the focused card. */
  editOpen?: boolean;
  onEditOpenChange?: (open: boolean) => void;
  /** Amend then re-stage — the honest two-op fallback (see review-flow.ts's
   *  editIntent for the FLAGGED GAP: no daemon override on approve exists to land an
   *  edited version in one shot). `editedId` only matters for a CREATE (no reliable
   *  target id rides a StagedSummary for one — the form surfaces it so the user
   *  confirms it explicitly rather than the client silently guessing it). */
  onEdit?: (item: StagedSummary, edited: Record<string, unknown>, editedId?: string) => void;
  /** U5 batch — is this card in the selection set (`x` toggles it; so does the
   *  checkbox — selection is mouse-usable in every instance, not just keyboard-hot
   *  ones). */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onApprove: (id: string, module: string) => void;
  onReject: (id: string, module: string, reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [selfDiffOpen, setSelfDiffOpen] = useState(false);
  const [selfEditing, setSelfEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // The diff pane is parent-controlled when `diffOpen` is supplied (the queue's `d`
  // shortcut drives the focused card); otherwise the card owns it locally.
  const controlled = diffOpen !== undefined;
  const isDiffOpen = controlled ? diffOpen : selfDiffOpen;
  const setDiffOpen = controlled ? (onDiffOpenChange ?? (() => {})) : setSelfDiffOpen;

  // U5.1 — reject-taxonomy: controlled (rejectOpen) carries the keyboard highlight
  // for the focused card; uncontrolled falls back to the pre-existing click-to-open
  // (no highlight — a plain mouse pick, exactly as before U5).
  const rejectControlled = rejectOpen !== undefined;
  const isRejecting = rejectControlled ? rejectOpen : rejecting;
  const highlightIdx = rejectControlled ? (reasonIndex ?? 0) : -1;
  const openReject = () => (rejectControlled ? onRejectOpenChange?.(true) : setRejecting(true));
  const closeReject = () => (rejectControlled ? onRejectOpenChange?.(false) : setRejecting(false));

  // U5.2 — edit-before-approve: same controlled/uncontrolled split as diffOpen.
  const editControlled = editOpen !== undefined;
  const isEditing = editControlled ? editOpen : selfEditing;
  const openEdit = () => (editControlled ? onEditOpenChange?.(true) : setSelfEditing(true));
  const closeEdit = () => (editControlled ? onEditOpenChange?.(false) : setSelfEditing(false));

  const change = (item.change ?? {}) as Record<string, unknown>;
  const editableKeys = Object.keys(change).filter((k) => typeof change[k] === "string");
  const isCreate = !isUpdate(item);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  // (Re)seed the edit draft from the CURRENT proposed fields whenever the form opens
  // — deliberately keyed on the open transition only, not on `item` (which is a fresh
  // object every queue refetch), so an in-flight edit is never clobbered mid-type.
  useEffect(() => {
    if (!isEditing) return;
    const seed: Record<string, string> = {};
    for (const k of editableKeys) seed[k] = change[k] as string;
    setEditValues(seed);
    setEditId(String(item.target ?? item.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const submitEdit = () => {
    onEdit?.(item, { ...editValues }, isCreate ? editId.trim() : undefined);
    closeEdit();
  };

  return (
    <div
      ref={ref}
      className={`rounded-ui border bg-surface p-2 transition-colors ${focused ? "border-accent ring-1 ring-inset ring-focus" : "border-border"}`}
    >
      <Stack gap="xs">
        <Inline gap="sm" align="center">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={() => onToggleSelect(item.id)}
              aria-label={`select ${item.title} for batch approve`}
              className="size-3.5 accent-current"
            />
          )}
          {/* U2 — the surface most ABOUT proposals now READS as one: the type label
              (Knowledge/Guardrail/…) rides the shared proposal-state badge instead
              of a solid module-hue Chip, which used to make this card look the
              most "settled" of the three old pending treatments. */}
          {(() => { const c = proposalChip(item.change?.type, item.module); return <ProposalBadge state="pending" label={c.label} />; })()}
          <Text size="ui" weight="medium" truncate>{item.title}</Text>
          {/* U4 — the scorer's meter: confidence × blast-radius, replacing the old
              stray muted `item.confidence` text line. Display only (KTD4/the moat):
              it never approves/rejects, it just tells you how much scrutiny this one
              deserves before you do. */}
          <ConfidenceMeter item={item} />
        </Inline>
        <Text size="meta" tone="muted">{reasonLine(item.evidence?.[0]?.kind, item.evidence)}</Text>
        {item.preview && <Text size="meta" tone="muted">{item.preview}</Text>}
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
        {isEditing ? (
          <Stack gap="xs" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); closeEdit(); } }}>
            <Text size="meta" tone="subtle" weight="semibold">
              Edit — re-stages as a fresh proposal (no daemon edit-in-place yet; see review-flow.ts's editIntent)
            </Text>
            {isCreate && (
              <Stack gap="xs">
                <Text size="meta" tone="muted">id (confirm — a create carries no reliable target id)</Text>
                <input autoFocus value={editId} onChange={(e) => setEditId(e.target.value)} className={editInput} />
              </Stack>
            )}
            {editableKeys.map((k, i) => (
              <Stack key={k} gap="xs">
                <Text size="meta" tone="muted">{k}</Text>
                <input
                  autoFocus={!isCreate && i === 0}
                  value={editValues[k] ?? ""}
                  onChange={(e) => setEditValues((v) => ({ ...v, [k]: e.target.value }))}
                  className={editInput}
                />
              </Stack>
            ))}
            <Inline gap="sm">
              <Button variant="primary" size="sm" onClick={submitEdit}>Save & re-stage</Button>
              <Button variant="ghost" size="sm" onClick={closeEdit}>cancel</Button>
            </Inline>
          </Stack>
        ) : isRejecting ? (
          <Inline gap="xs" wrap>
            {REJECT_REASONS.map((r, i) => (
              <Button
                key={r}
                variant={rejectControlled && i === highlightIdx ? "primary" : "outline"}
                size="sm"
                onClick={() => { onReject(item.id, item.module, r); closeReject(); }}
              >
                {i + 1}. {r}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={closeReject}>cancel</Button>
          </Inline>
        ) : (
          <Inline gap="sm">
            <Button variant="primary" size="sm" onClick={() => onApprove(item.id, item.module)}>Approve</Button>
            <Button variant="ghost" size="sm" onClick={openReject}>Reject</Button>
            {onEdit && <Button variant="ghost" size="sm" onClick={openEdit}>Edit</Button>}
          </Inline>
        )}
      </Stack>
    </div>
  );
}

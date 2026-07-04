// shell/review/ProposalCard.tsx — one staged proposal at the gate, composed as ONE
// designed canvas (U7), not the accretion U2-U6 left behind. Fixed top-to-bottom
// hierarchy (CARD_SECTIONS below, the card's tested view-model contract):
//   identity (badge + title) → why (reason + provenance) → diff (the substance) →
//   decision (the scorer + the gestures, quiet until focus/hover).
// The scorer used to ride the identity row (a stray meter next to the title); it now
// pairs with the actions it triages, in the decision footer — the fork this unit
// resolves (see the file's bottom section + the PR report for the rationale).
// Approve lands it (→ evolve); Reject opens the reason taxonomy (the gate that
// teaches); Edit (U5) opens an inline amend-then-re-stage form; a checkbox (U5) joins
// the batch-selection set — selection stays in the identity row (always visible, not
// gesture-quiet: you need to see what's selected on cards you're NOT focused on).
// When `focused` (the keyboard decision flow, P2.4) the card rings + scrolls into
// view. On Approve/Reject (U7), the decision footer borrows the shared proposal
// motion (solidify/dissolve, U1/KTD2) for the brief in-flight window before the item
// leaves the queue — the same "ghost becomes real" language the World uses, now here
// too; the identity badge above stays a stable type pill, untouched by the transient.
// Bug fix: that in-flight window used to be a one-way door — a daemon-side failure
// left it stuck on "landing…" forever (no error, no way back). handleApprove/
// handleReject now await the outcome and clearsLanding (below) un-sticks it back to
// "actions" on a failure; the daemon's WHY still surfaces via the existing toast (see
// use-review-queue.ts's `why`/`softError`), not a new inline mechanism.
// Composes ds primitives + the kit Button; no hand-rolled layout beyond the two
// non-recipe-expressible chrome touches (the focus ring, the decision-footer's
// quiet-until-focus opacity) — both mirror the card's own pre-existing outer-div
// pattern, not new invented layout.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StagedSummary } from "#shared/index.js";
import { REJECT_REASONS } from "./review-model.js";
import { isUpdate } from "./diff.js";
import { reasonLine } from "./reason-line.js";
import { proposalChip } from "./proposal-chip.js";
import { provenanceOf } from "./provenance.js";
import { proposalTitle, targetPreview } from "./proposal-title.js";
import { DiffPreview } from "./DiffPreview.js";
import { ConfidenceMeter } from "./ConfidenceMeter.js";
import { api } from "../../lib/api.js";
import { Stack, Inline, Text, Button, Chip, ProposalBadge } from "../../ds/index.js";
import type { ProposalState } from "../../ds/index.js";

const editInput = "w-full rounded-ui border border-border bg-app px-2 py-1 text-meta text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim";

// ── the card's view-model (U7) — a tested contract, not just an implicit render order ──

/** The four macro sections, in the imposed hierarchy. Exported so the ordering is a
 *  pinned invariant (hitl-canvas.test.ts) — a future edit that silently reshuffles the
 *  render breaks a test, not just a design review. */
export const CARD_SECTIONS = ["identity", "why", "diff", "decision"] as const;
export type CardSection = (typeof CARD_SECTIONS)[number];

/** The decision section's active sub-mode — never more than one at a time. `landing`
 *  (an approve/reject already dispatched, see `landing` state below) takes priority
 *  over `editing`/`rejecting` (both close themselves before landing fires, but this
 *  keeps the priority explicit and correct even if a caller drives them oddly);
 *  `editing` beats `rejecting` (mirrors the pre-U7 ternary order verbatim — no
 *  behavior change, just named + tested). Pure — no rendering, no side effects. */
export type DecisionMode = "landing" | "editing" | "rejecting" | "actions";
export function decisionMode(opts: { landing: boolean; editing: boolean; rejecting: boolean }): DecisionMode {
  if (opts.landing) return "landing";
  if (opts.editing) return "editing";
  if (opts.rejecting) return "rejecting";
  return "actions";
}

/** Bug fix: `landing` used to be set on click and NEVER cleared — a daemon-side
 *  failure (a rejected approve/reject mutation) left the card stuck on "landing…"
 *  forever, with no error shown and no way back to actionable. This is the pure
 *  contract for the fix: a FAILED outcome clears `landing` (→ decisionMode falls
 *  through to "actions", the card is actionable again); a SUCCESSFUL one leaves it
 *  set — the card is expected to unmount on its own once the queue's post-mutation
 *  invalidate (use-review-queue.ts) refetches and the now-landed id drops out of the
 *  list. Exported + pure so this transition is a tested contract (hitl-canvas.test.ts
 *  style), not just inline component logic. */
export function clearsLanding(ok: boolean): boolean {
  return !ok;
}

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
  /** Resolves `true` once the daemon actually lands the change, `false` on a
   *  refused/failed mutation (never throws — use-review-queue.ts's approve/reject
   *  already catch + toast the daemon's reason; this return is ONLY the landing
   *  signal `clearsLanding` acts on, see handleApprove/handleReject below). */
  onApprove: (id: string, module: string) => Promise<boolean>;
  onReject: (id: string, module: string, reason: string) => Promise<boolean>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [selfDiffOpen, setSelfDiffOpen] = useState(false);
  const [selfEditing, setSelfEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState("");
  // U7 — the brief in-flight visual (borrows the shared proposal motion, KTD2): set
  // synchronously on click, alongside (never instead of) the real onApprove/onReject
  // call below — KTD5 holds, this is purely a local render flag, no new landing path.
  const [landing, setLanding] = useState<ProposalState | null>(null);
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
  const closeReject = () => (rejectControlled ? onRejectOpenChange?.(false) : setRejecting(false));

  // U5.2 — edit-before-approve: same controlled/uncontrolled split as diffOpen.
  const editControlled = editOpen !== undefined;
  const isEditing = editControlled ? editOpen : selfEditing;
  const openEdit = () => (editControlled ? onEditOpenChange?.(true) : setSelfEditing(true));
  const closeEdit = () => (editControlled ? onEditOpenChange?.(false) : setSelfEditing(false));

  const mode = decisionMode({ landing: landing !== null, editing: isEditing, rejecting: isRejecting });

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

  // U7 — approve/reject set the brief local `landing` flag alongside the SAME
  // existing calls (KTD5: no new path, same onApprove/onReject the queue passes in).
  // Bug fix: await the outcome and clear `landing` on a failure (clearsLanding above)
  // — previously this fired the call and forgot it, so a daemon-side failure left the
  // card stuck on "landing…" forever with no way back to Approve/Reject.
  const handleApprove = () => {
    setLanding("approving");
    void onApprove(item.id, item.module).then((ok) => { if (clearsLanding(ok)) setLanding(null); });
  };
  const handleReject = (reason: string) => {
    setLanding("rejecting");
    void onReject(item.id, item.module, reason).then((ok) => { if (clearsLanding(ok)) setLanding(null); });
    closeReject();
  };

  const c = proposalChip(item.change?.type, item.module);
  const prov = provenanceOf(item.source);

  // Bug fix (live product test): DELETE/DEPRECATE/UPDATE proposals used to render
  // `item.title` verbatim in the identity heading — for these ops the server can
  // degrade that all the way to the raw stg-… id when the staged change carries no
  // title/body/rationale (zuzuu-peek.ts's stagedTitle fallback chain), so a critical
  // delete rendered as `stg-53ea6bc7` with no hint of what it removes. `proposalTitle`
  // (proposal-title.ts) derives the heading from op+target instead — never the id —
  // and is the SAME helper NoteDocument.tsx's inline U8 card uses (one source of
  // truth). The target-note fetch shares DiffPreview's exact queryKey, so it's the
  // same react-query cache entry (no duplicate request) — it just ALSO covers
  // delete/deprecate (DiffPreview's own fetch is update-only, since there's no field
  // diff to show for those ops) so the title can upgrade from a prettified id to the
  // note's real name, and the WHY section below can show a small removal preview.
  const targetNote = useQuery({
    queryKey: ["zuzuu", "item-body", item.module, item.target],
    queryFn: () => api.zuzuu.item(item.module, item.target as string),
    enabled: typeof item.target === "string" && item.target.length > 0,
    staleTime: 30_000,
  });
  const title = proposalTitle(item, targetNote.data);
  const preview = targetPreview(targetNote.data);
  // A delete/deprecate has no field diff (DiffPreview renders nothing for it) — this
  // is the one place its target surfaces: the id at minimum, the note's own preview
  // when it resolves. An update already gets this via the field diff below, so it's
  // not repeated here.
  const showsTargetLine = (item.op === "delete" || item.op === "deprecate") && item.target;

  return (
    <div
      ref={ref}
      className={`rounded-ui border bg-surface p-3 transition-colors ${focused ? "border-accent ring-1 ring-inset ring-focus" : "border-border"}`}
    >
      <Stack gap="sm">
        {/* 1. IDENTITY — what this proposal is + its type, at a glance. Selection
            stays here (always visible, not gesture-quiet — you scan it across every
            card, not just the focused one). Stays a stable "what type of thing is
            this" pill even while landing — the transient in-flight motion lives in
            the decision footer below, not overloaded onto this identity chip. */}
        <Inline gap="sm" align="center">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={() => onToggleSelect(item.id)}
              aria-label={`select ${title} for batch approve`}
              className="size-3.5 accent-current"
            />
          )}
          <ProposalBadge state="pending" label={c.label} />
          <Text size="ui" weight="medium" truncate>{title}</Text>
        </Inline>

        {/* 2. WHY — the case for this proposal: the reason line, an optional preview,
            and its session provenance. Quiet by design (muted/subtle tones) — this is
            context, not the decision itself. */}
        <Stack gap="xs">
          <Text size="meta" tone="muted">{reasonLine(item.evidence?.[0]?.kind, item.evidence)}</Text>
          {/* delete/deprecate carry no field diff (below) — this is the one place
              their target surfaces: the address always, the note's own preview when
              it resolves. Never a bare card with no indication of what's affected. */}
          {showsTargetLine && (
            <Inline gap="xs" align="center">
              <Text size="meta" tone="subtle">target</Text>
              <Text size="meta" tone="muted" mono>{item.module}:{item.target}</Text>
            </Inline>
          )}
          {showsTargetLine && preview && <Text size="meta" tone="muted">{preview}</Text>}
          {item.preview && <Text size="meta" tone="muted">{item.preview}</Text>}
          {prov && (
            <Inline gap="xs" wrap align="center">
              <Text size="meta" tone="subtle">{prov.label}</Text>
              {prov.display.map((s, i) => <Chip key={prov.sessions[i] ?? s} label={s} tone="neutral" />)}
            </Inline>
          )}
        </Stack>

        {/* 3. THE DIFF — the substance: exactly what lands, field + body (U3). */}
        <DiffPreview item={item} open={isDiffOpen} onOpenChange={setDiffOpen} />

        {/* 4. THE DECISION — the scorer triages, the gestures act. Quiet (reduced
            opacity) until focused/hovered/keyboard-active, so a resting queue reads
            calm and the diff/why above carry the visual weight; a smooth opacity
            transition on focus, matching the queue's own focus ring. */}
        {mode === "landing" ? (
          // U7 — the brief in-flight moment: the shared solidify/dissolve motion
          // (KTD2, the same keyframes the World's ghost uses) stands in for a
          // spinner, then the card leaves the queue once the gate call resolves.
          <Inline gap="sm" align="center">
            <ProposalBadge state={landing!} />
            <Text size="meta" tone="muted">{landing === "approving" ? "landing…" : "leaving the queue…"}</Text>
          </Inline>
        ) : mode === "editing" ? (
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
        ) : mode === "rejecting" ? (
          <Inline gap="xs" wrap>
            {REJECT_REASONS.map((r, i) => (
              <Button
                key={r}
                variant={rejectControlled && i === highlightIdx ? "primary" : "outline"}
                size="sm"
                onClick={() => handleReject(r)}
              >
                {i + 1}. {r}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={closeReject}>cancel</Button>
          </Inline>
        ) : (
          <div className={`transition-opacity ${focused ? "opacity-100" : "opacity-80 hover:opacity-100 focus-within:opacity-100"}`}>
            <Inline gap="sm" justify="between" align="center">
              <ConfidenceMeter item={item} />
              <Inline gap="sm">
                <Button variant="primary" size="sm" onClick={handleApprove}>Approve</Button>
                <Button variant="ghost" size="sm" onClick={() => (rejectControlled ? onRejectOpenChange?.(true) : setRejecting(true))}>Reject</Button>
                {onEdit && <Button variant="ghost" size="sm" onClick={openEdit}>Edit</Button>}
              </Inline>
            </Inline>
          </div>
        )}
      </Stack>
    </div>
  );
}

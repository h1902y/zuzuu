// shell/stage/SaveViewForm.tsx — U5 (live-views plan, docs/plans/2026-07-04-002):
// "Save as view" — a toolbar control that turns the table's CURRENT filter/
// group/sort into a new `type:view` note, instantly. Sits beside TableBuilders
// in Everything.tsx/Grid.tsx (same anchored-popover shape as FieldConfigPanel:
// a trigger button + a Scrim + a small panel, never a modal).
//
// THE ONE WRITE THIS FEATURE MAKES, and it is the OPERATOR lane (KTD4): the
// view is the user's OWN pen, so it lands NOW via `api.zuzuu.createRow` (the
// daemon's `POST /module/:key/row` → `note.create`, agent-denied at the
// route) — never the gate/stage (`dataProvider.create`/`stage()`), which
// would sit a self-authored view in the user's own review queue. All
// derivation (id, validation, the change body, the preview line) lives in
// save-view-model.ts — this component only wires state → model → api
// (`web/CLAUDE.md`'s logic-in-.ts discipline).
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import type { ListState } from "../../data/list-state.js";
import { viewNoteId, saveViewProblems, saveViewChange, saveViewPreview } from "./save-view-model.js";
import { api } from "../../lib/api.js";
import { toast } from "../../state/toast.js";
import { Stack, Inline, Text, Button, Icon } from "../../ds/index.js";

const inputCls = "w-full rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim";

function Scrim({ onClose }: { onClose: () => void }) {
  return <button type="button" aria-label="close" onClick={onClose} className="fixed inset-0 z-10 cursor-default" />;
}

/** `module` is the table's own scope (`useList().module`) — a view note lands
 *  IN that module (beside what it's about, matching
 *  `docs/guide/Modules-as-Tables.md`'s `zz note create crm view-pipeline`).
 *  Everything's unified scope can be `""` (no module facet chosen) — there is
 *  no single module home for a view in that state, so the control disables
 *  itself with an explanatory hint rather than guessing one. */
export function SaveViewForm({ module, state }: { module: string; state: ListState }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  if (!module) {
    return (
      <Button variant="ghost" size="sm" disabled title="Pick a module to save a view">
        <Icon icon={Bookmark} size={13} /> Save as view
      </Button>
    );
  }

  const problems = saveViewProblems(title);
  const preview = saveViewPreview(state);
  const close = () => { setOpen(false); setTitle(""); };

  async function save() {
    setSaving(true);
    try {
      const change = saveViewChange(state, module, title);
      const id = viewNoteId(title, Date.now());
      await api.zuzuu.createRow(module, id, change);
      toast(`View '${change.title}' saved`);
      void qc.invalidateQueries({ queryKey: ["zuzuu"] });
      close();
    } catch (e) {
      toast(e instanceof Error && e.message ? `Couldn’t save the view — ${e.message}` : "Couldn’t save the view", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
        <Icon icon={Bookmark} size={13} /> Save as view
      </Button>
      {open && (
        <>
          <Scrim onClose={close} />
          <div className="animate-pop absolute left-0 top-full z-20 mt-1 w-72 rounded-ui border border-border bg-elevated p-2 shadow-overlay">
            <Stack gap="sm">
              <Text size="meta" tone="subtle" weight="semibold">SAVE AS VIEW</Text>
              <Stack gap="xs">
                <Text size="meta" tone="muted">title *</Text>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !problems.length && !saving) void save(); }}
                  placeholder="e.g. Open pipeline by stage"
                  className={inputCls}
                />
              </Stack>
              <Stack gap="xs">
                <Text size="meta" tone="muted">this view captures</Text>
                <Text size="meta" tone="subtle">{preview}</Text>
              </Stack>
              <Stack gap="xs">
                <Inline gap="xs">
                  <Button variant="primary" size="sm" disabled={problems.length > 0 || saving} onClick={() => void save()}>
                    {saving ? "…" : "Save view"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={close} disabled={saving}>Cancel</Button>
                </Inline>
                <Text size="meta" tone="muted">
                  {problems.length > 0 ? problems[0] : `Lands instantly in ${module} — reachable from ⌘K.`}
                </Text>
              </Stack>
            </Stack>
          </div>
        </>
      )}
    </div>
  );
}

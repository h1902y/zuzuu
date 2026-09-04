// shell/stage/FieldConfigPanel.tsx — the field-config panel (§H.5, Airtable's
// edit-field made zuzuu): opens from a column header's caret ("Edit column") or
// the toolbar's "+ column" (single-module scope only, Grid.tsx). ANCHORED (a
// popover under the trigger), NEVER a modal. Save is a canned module
// add-column/alter-column invocation through the daemon (operator-gated, mints a
// generation — rollback-able); Cancel discards, no partial writes either way.
// field-config-model.ts owns the pure state; this is a thin dispatch + ds markup.
//
// U4 (curried-plotting-coral.md): the hand-rolled full-screen `Scrim` button is
// gone — this now composes the shared `ds/kit/Popover` (U2), which gives it
// outside-click + topmost-only Escape from the overlay stack. Not a single-select
// picker (it's a whole form with Save/Cancel) so no `closeOnSelect` — Save/Cancel
// call `onClose` explicitly, same as before. `className` overrides Popover's
// default panel chrome (this form is wider + internally scrolling, unlike the
// w-72 TableBuilders shape); `placement` maps `align` onto Popover's contract.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import type { ModuleColumnResult } from "#shared/index.js";
import type { FieldDef } from "../../data/field-registry.js";
import {
  FIELD_TYPES, stateFromField, toBody, isValid, takesOptions, offersNowDefault,
  addOption, removeOption, optionHue, type FieldConfigState,
} from "./field-config-model.js";
import { TypeGlyph } from "./TypeGlyph.js";
import { ModuleDot } from "./FacetChip.js";
import { api } from "../../lib/api.js";
import { toast } from "../../state/toast.js";
import { Stack, Inline, Text, Button, Icon, Popover } from "../../ds/index.js";

const inputCls = "w-full rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim";
const toggleCls = (on: boolean) =>
  `inline-flex w-fit items-center gap-1 rounded-ui border px-2 py-1 text-meta transition-colors ${on ? "border-accent-dim bg-selected text-ink-100" : "border-border bg-app text-subtle hover:bg-hover hover:text-ink-100"}`;

export function FieldConfigPanel({ module, field, name = "", existingNames = [], onClose, onSaved, align = "left" }: {
  module: string;
  /** null = add mode ("+ column"); a FieldDef = edit mode ("Edit column"). */
  field: FieldDef | null;
  /** add mode only: pre-fill the name (e.g. "promote" a schemaless header's
   *  inferred column into a real, declared one). Ignored in edit mode. */
  name?: string;
  /** the module's other declared column names — a light client-side duplicate
   *  check in add mode (the CLI is still the real gate; this is UX only). */
  existingNames?: readonly string[];
  onClose: () => void;
  onSaved?: (result: ModuleColumnResult) => void;
  /** which edge the popover hangs from — a header caret near the right rail
   *  wants `align="right"`; the toolbar's "+ column" wants the default left. */
  align?: "left" | "right";
}) {
  const [state, setState] = useState<FieldConfigState>(() => stateFromField(field, name));
  const [optionDraft, setOptionDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const gens = useQuery({ queryKey: ["zuzuu", "generations", module], queryFn: () => api.zuzuu.generations(module) });
  const nextGen = gens.data ? Number(gens.data.active ?? 0) + 1 : null;
  const edit = field !== null;
  const patch = (p: Partial<FieldConfigState>) => setState((s) => ({ ...s, ...p }));
  const duplicate = !edit && existingNames.includes(state.name.trim());

  async function save() {
    setSaving(true);
    try {
      const body = toBody(state);
      const result = edit
        ? await api.zuzuu.alterColumn(module, state.name, body)
        : await api.zuzuu.addColumn(module, state.name.trim(), body);
      toast(edit ? `Column '${state.name}' updated` : `Column '${state.name}' added`);
      void qc.invalidateQueries({ queryKey: ["zuzuu"] });
      onSaved?.(result);
      onClose();
    } catch (e) {
      toast(e instanceof Error && e.message ? `Couldn’t save — ${e.message}` : "Couldn’t save the column", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open
      onClose={onClose}
      placement={align === "right" ? "below-right" : "below-left"}
      className={`z-20 mt-1 max-h-[75vh] w-80 overflow-y-auto rounded-ui border border-border bg-elevated p-3 shadow-overlay`}
    >
      <Stack gap="sm">
        <Text size="meta" tone="subtle" weight="semibold">{edit ? "EDIT COLUMN" : "NEW COLUMN"}</Text>

        {/* name — immutable once created: a refactor, offered separately */}
        <Stack gap="xs">
          <Text size="meta" tone="muted">name</Text>
          {edit ? (
            <Text size="ui" mono tone="subtle">{state.name}</Text>
          ) : (
            <input value={state.name} onChange={(e) => patch({ name: e.target.value })} placeholder="kebab_or_snake_case" className={inputCls} />
          )}
          {edit ? (
            <Text size="meta" tone="muted">Renaming is a refactor, not offered here.</Text>
          ) : duplicate ? (
            <Text size="meta" tone="danger">'{state.name.trim()}' already exists on this module.</Text>
          ) : null}
        </Stack>

        {/* label */}
        <Stack gap="xs">
          <Text size="meta" tone="muted">label</Text>
          <input value={state.label} onChange={(e) => patch({ label: e.target.value })} placeholder={state.name || "display name"} className={inputCls} />
        </Stack>

        {/* type picker: the 8 types + the ƒ computed toggle (orthogonal — a
            computed column still has an underlying type; TypeGlyph already
            shows ƒ over it regardless of which) */}
        <Stack gap="xs">
          <Text size="meta" tone="muted">type</Text>
          <div className="flex flex-wrap gap-1">
            {FIELD_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => patch({ type: t, options: takesOptions(t) ? state.options : [] })}
                className={toggleCls(state.type === t)}
              >
                <TypeGlyph type={t} /> {t}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => patch({ computed: !state.computed })} className={toggleCls(state.computed)}>
            <TypeGlyph type={state.type} computed /> ƒ computed
          </button>
          {state.computed && (
            <>
              <input
                value={state.formula}
                onChange={(e) => patch({ formula: e.target.value })}
                placeholder="dateAdd(start_date,duration_days)"
                className={inputCls}
              />
              <Text size="meta" tone="muted">Derived at index time, never written to the note file — dateAdd(a,b) is the first builtin, more later.</Text>
            </>
          )}
        </Stack>

        {/* select/multi: an options editor with stable-hue pill previews */}
        {takesOptions(state.type) && (
          <Stack gap="xs">
            <Text size="meta" tone="muted">options</Text>
            {state.options.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {state.options.map((o) => (
                  <span key={o} className="inline-flex items-center gap-1 rounded-full border border-border bg-app px-2 py-0.5 text-meta text-subtle">
                    <ModuleDot color={`hsl(${optionHue(o)} 58% 60%)`} />
                    {o}
                    <button type="button" aria-label={`remove ${o}`} onClick={() => patch({ options: removeOption(state.options, o) })} className="text-muted transition-colors hover:text-ink-100">
                      <Icon icon={X} size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Inline gap="xs">
              <input
                value={optionDraft}
                onChange={(e) => setOptionDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { patch({ options: addOption(state.options, optionDraft) }); setOptionDraft(""); } }}
                placeholder="add an option"
                className={inputCls}
              />
              <Button
                variant="outline" size="sm"
                onClick={() => { patch({ options: addOption(state.options, optionDraft) }); setOptionDraft(""); }}
                disabled={!optionDraft.trim()}
              >
                <Icon icon={Plus} size={12} />
              </Button>
            </Inline>
          </Stack>
        )}

        {/* date: the ISO-storage teaching line + "default to current date" */}
        {offersNowDefault(state.type) && !state.computed && (
          <Stack gap="xs">
            <Text size="meta" tone="muted">Stored as ISO (YYYY-MM-DD) always — this only affects how it renders.</Text>
            <button
              type="button"
              onClick={() => patch({ defaultMode: state.defaultMode === "now" ? "none" : "now" })}
              className={toggleCls(state.defaultMode === "now")}
            >
              default to current date
            </button>
          </Stack>
        )}
        {state.type === "number" && <Text size="meta" tone="muted">Numbers align right in the table.</Text>}
        {state.type === "link" && <Text size="meta" tone="muted">Stores a target note's id — the grid resolves its title at render time.</Text>}

        {/* static default — suppressed while computed or while "now" is chosen */}
        {!state.computed && state.defaultMode !== "now" && (
          <Stack gap="xs">
            <Text size="meta" tone="muted">default</Text>
            <input
              value={state.defaultValue}
              onChange={(e) => patch({ defaultValue: e.target.value, defaultMode: e.target.value ? "static" : "none" })}
              placeholder="fills on create, when absent"
              className={inputCls}
            />
          </Stack>
        )}

        {/* required — with the honest consequence note */}
        <Stack gap="xs">
          <button type="button" onClick={() => patch({ required: !state.required })} className={toggleCls(state.required)}>
            required
          </button>
          {state.required && (
            <Text size="meta" tone="muted">
              Existing rows missing it become invalid until backfilled — zz module backfill heals them (not wired from here).
            </Text>
          )}
        </Stack>

        {/* description */}
        <Stack gap="xs">
          <Text size="meta" tone="muted">description</Text>
          <textarea
            value={state.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="shown as a header tooltip + on the schema card"
            className={`${inputCls} min-h-16`}
          />
        </Stack>

        <Stack gap="xs">
          <Inline gap="xs">
            <Button variant="primary" size="sm" disabled={!isValid(state) || duplicate || saving} onClick={() => void save()}>
              {saving ? "…" : edit ? "Save" : "Add column"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          </Inline>
          <Text size="meta" tone="muted">
            {nextGen != null ? `Saves as generation ${nextGen} — rollback-able.` : "Saves as a new generation — rollback-able."}
          </Text>
        </Stack>
      </Stack>
    </Popover>
  );
}

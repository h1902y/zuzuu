// shell/wing/Form.tsx — the row's edit form (R14, the gate). Edits the note's scalar
// fields + body; saving serializes ONLY the changed fields (form-model.toChange) and
// resolves to a PENDING proposal (DataProvider.update → the review queue), never a
// landed row. v1 infers editable fields from the note (declared `fields` → T2.5).
// Static utilities only.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModuleItem } from "#shared/index.js";
import { buildForm, dirtyFields, toChange } from "./form-model.js";
import { editableFieldDefs } from "../stage/property-stack.js";
import { fieldsFromSchema } from "../stage/schema-fields.js";
import { api } from "../../lib/api.js";
import { dataProvider } from "../../data/provider.js";
import { toast } from "../../state/toast.js";
import { Stack, Text, Button } from "../../ds/index.js";

function FormInner({ module, id, item, fields }: { module: string; id: string; item: ModuleItem; fields: ReturnType<typeof editableFieldDefs> }) {
  const original = buildForm(fields, item);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const dirty = dirtyFields(original, edited);
  const set = (name: string, v: string) => setEdited((s) => ({ ...s, [name]: v }));

  async function save() {
    setSaving(true);
    try {
      await dataProvider.update(module, id, toChange(original, edited));
      toast("Change staged for review");
      setEdited({});
      void qc.invalidateQueries({ queryKey: ["zuzuu"] });
    } catch { toast("Couldn’t stage the change", "error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <Stack gap="md">
        <Text size="meta" tone="subtle" weight="semibold">EDIT</Text>
        <Stack gap="sm">
          {original.map((f) => (
            <Stack key={f.name} gap="xs">
              <Text size="meta" tone="muted">{f.label}</Text>
              {f.multiline ? (
                <textarea
                  value={edited[f.name] ?? f.value}
                  onChange={(e) => set(f.name, e.target.value)}
                  className="min-h-24 w-full rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none focus:border-accent-dim"
                />
              ) : (
                <input
                  value={edited[f.name] ?? f.value}
                  onChange={(e) => set(f.name, e.target.value)}
                  className="w-full rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none focus:border-accent-dim"
                />
              )}
            </Stack>
          ))}
        </Stack>
        <Button variant="primary" size="sm" disabled={!dirty.length || saving} onClick={save}>
          {saving ? "…" : dirty.length ? `Stage ${dirty.length} change${dirty.length > 1 ? "s" : ""}` : "No changes"}
        </Button>
        <Text size="meta" tone="muted">Saves resolve to a pending proposal — review to land it.</Text>
      </Stack>
    </div>
  );
}

export function Form({ module, id }: { module: string; id: string }) {
  const q = useQuery({ queryKey: ["zuzuu", "item", module, id], queryFn: () => dataProvider.getOne(module, id) });
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });
  if (q.isLoading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  if (!q.data) return <div className="grid h-full place-items-center"><Text tone="muted">no record</Text></div>;
  // schema-aware (P2.3): declared fields drive the form's order + types; body last.
  const fields = editableFieldDefs(q.data, fieldsFromSchema(schema.data?.schema));
  return <FormInner key={id} module={module} id={id} item={q.data} fields={fields} />;
}

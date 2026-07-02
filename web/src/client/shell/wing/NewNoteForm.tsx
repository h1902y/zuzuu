// shell/wing/NewNoteForm.tsx — the New-note DRAFT form (audit item 3): schema-first,
// never a blind stage. "New note" used to stage `{title: "Untitled note"}` — on a
// module with required columns that proposal could never be approved (a poison
// proposal the user had to reject themselves). Now the form opens FIRST: typed
// inputs from the declared schema, required markers, a type + slug id — and the
// Stage button stays disabled until the draft is approvable (draft-model, pure).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { dataProvider } from "../../data/provider.js";
import { fieldConfig } from "../../data/field-registry.js";
import { fieldsFromSchema } from "../stage/schema-fields.js";
import { newNoteId } from "../stage/stage-header.js";
import { draftProblems, draftChange } from "./draft-model.js";
import { useWorld } from "../world-state.js";
import { toast } from "../../state/toast.js";
import { Stack, Text, Button } from "../../ds/index.js";

const input = "w-full rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim";

export function NewNoteForm({ module }: { module: string }) {
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });
  const select = useWorld((s) => s.select);
  const qc = useQueryClient();
  const [id, setId] = useState(() => newNoteId(Date.now()));
  const [type, setType] = useState("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [staging, setStaging] = useState(false);

  if (schema.isLoading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  const fields = fieldsFromSchema(schema.data?.schema);
  const problems = draftProblems(fields, values, id, type);
  const set = (name: string, v: string) => setValues((s) => ({ ...s, [name]: v }));

  async function stage() {
    setStaging(true);
    try {
      const change = draftChange(fields, values, type, (f, raw) => fieldConfig(f.type).parse(raw));
      if (title.trim()) change.title = title.trim();
      if (body.trim()) change.body = body.trim();
      await dataProvider.create(module, id.trim(), change);
      toast("New note staged for review — press R");
      void qc.invalidateQueries({ queryKey: ["zuzuu"] });
      select({ kind: "module", id: module });
    } catch (e) {
      toast(e instanceof Error && e.message ? `Couldn’t stage — ${e.message}` : "Couldn’t stage the note", "error");
    } finally { setStaging(false); }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <Stack gap="md">
        <Text size="meta" tone="subtle" weight="semibold">NEW NOTE</Text>
        <Stack gap="sm">
          <Stack gap="xs">
            <Text size="meta" tone="muted">id *</Text>
            <input value={id} onChange={(e) => setId(e.target.value)} className={input} placeholder="kebab-case-slug" />
          </Stack>
          <Stack gap="xs">
            <Text size="meta" tone="muted">type *</Text>
            <input value={type} onChange={(e) => setType(e.target.value)} className={input} placeholder="note" />
          </Stack>
          <Stack gap="xs">
            <Text size="meta" tone="muted">title</Text>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
          </Stack>
          {fields.map((f) => (
            <Stack key={f.name} gap="xs">
              <Text size="meta" tone="muted">{f.label ?? f.name}{f.required ? " *" : ""}</Text>
              {f.options?.length ? (
                <select value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} className={input}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} className={input} />
              )}
            </Stack>
          ))}
          <Stack gap="xs">
            <Text size="meta" tone="muted">body</Text>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className={`${input} min-h-24`} />
          </Stack>
        </Stack>
        <Button variant="primary" size="sm" disabled={problems.length > 0 || staging} onClick={() => void stage()}>
          {staging ? "…" : "Stage for review"}
        </Button>
        {problems.length > 0 ? (
          <Text size="meta" tone="muted">{problems[0]}</Text>
        ) : (
          <Text size="meta" tone="muted">Staging resolves to a pending proposal — review to land it.</Text>
        )}
      </Stack>
    </div>
  );
}

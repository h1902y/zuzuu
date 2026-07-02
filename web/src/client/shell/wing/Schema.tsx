// shell/wing/Schema.tsx — the module wing: its declared COLUMNS (§H.5's schema
// card — the contract, visible: name · type · required · default · description ·
// ƒ formula) + its per-module generations (the content-addressed lineage) +
// rollback (R15). Active generation is marked; any prior one can be restored (a
// pointer-flip + content restore). Columns here are READ-ONLY (§H.6 doctrine):
// edit via the grid's header caret or "+ column" toolbar (FieldConfigPanel),
// never a second write surface.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { toast } from "../../state/toast.js";
import { fieldsFromSchema } from "../stage/schema-fields.js";
import { TypeGlyph } from "../stage/TypeGlyph.js";
import { Stack, Inline, Text, Button } from "../../ds/index.js";

export function Schema({ module }: { module: string }) {
  const qc = useQueryClient();
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });
  const q = useQuery({ queryKey: ["zuzuu", "generations", module], queryFn: () => api.zuzuu.generations(module) });
  const fields = fieldsFromSchema(schema.data?.schema);

  async function rollback(id: string) {
    try {
      await api.zuzuu.rollback(module, id);
      toast(`Rolled ${module} back to ${id}`);
      void qc.invalidateQueries({ queryKey: ["zuzuu"] });
    } catch { toast("Couldn’t roll back", "error"); }
  }

  if (q.isLoading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  const data = q.data;

  return (
    <div className="h-full overflow-y-auto p-6">
      <Stack gap="lg">
        <Stack gap="md">
          <Text size="meta" tone="subtle" weight="semibold">COLUMNS</Text>
          {!fields.length ? (
            <Text size="meta" tone="muted">schemaless — no declared columns yet (any frontmatter goes)</Text>
          ) : (
            <div className="overflow-hidden rounded-ui border border-border">
              {fields.map((f) => (
                <div key={f.name} className="flex items-start gap-3 border-b border-border px-3 py-2 last:border-b-0">
                  <span className="mt-0.5 shrink-0"><TypeGlyph type={f.type} computed={Boolean(f.computed)} /></span>
                  <Stack gap="none">
                    <Inline gap="xs" wrap>
                      <Text size="ui" tone="default">{f.label ?? f.name}</Text>
                      <Text size="meta" mono tone="muted">{f.name}</Text>
                      {f.required && <Text size="meta" tone="danger">required</Text>}
                      {f.default != null && <Text size="meta" tone="muted">default: {f.default}</Text>}
                    </Inline>
                    {f.computed && <Text size="meta" tone="muted">ƒ {f.computed}</Text>}
                    {/* the description reads as a quiet subtext line here (the schema
                        card's fuller surface); the grid header carries it as a tooltip */}
                    {f.description && <Text size="meta" tone="muted">{f.description}</Text>}
                  </Stack>
                </div>
              ))}
            </div>
          )}
        </Stack>

        <Stack gap="md">
          <Text size="meta" tone="subtle" weight="semibold">GENERATIONS</Text>
          {!data || !data.generations.length ? (
            <Text size="meta" tone="muted">no generations yet</Text>
          ) : (
            <Stack gap="sm">
              {data.generations.map((g) => (
                <Inline key={g.id} gap="sm" justify="between" align="start">
                  <Stack gap="none">
                    <Text size="ui" tone={g.id === data.active ? "accent" : "default"}>
                      {g.id}{g.id === data.active ? " · active" : ""}
                    </Text>
                    {g.mintedAt && <Text size="meta" tone="muted">{g.mintedAt}</Text>}
                  </Stack>
                  {g.id !== data.active && (
                    <Button variant="outline" size="sm" onClick={() => rollback(g.id)}>rollback</Button>
                  )}
                </Inline>
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>
    </div>
  );
}

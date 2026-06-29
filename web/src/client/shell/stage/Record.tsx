// shell/stage/Record.tsx — the row stage: one note, read view (R14). Title + kind/
// status, then a schema-aware typed property stack (P2.3 — declared module.md fields
// first, in order + typed; then inferred scalars), then the body. The editable form
// rides in the wing for the same selection. Loads via getOne + the module schema;
// thin (ordering/formatting is property-stack.ts). Static utilities only.
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "../../data/provider.js";
import { api } from "../../lib/api.js";
import { fieldsFromSchema } from "./schema-fields.js";
import { propertyStack } from "./property-stack.js";
import { describeCell } from "./grid-columns.js";
import { Cell } from "./Cell.js";
import { provenanceOf } from "../review/provenance.js";
import { Stack, Inline, Text, Chip, Markdown } from "../../ds/index.js";

export function Record({ module, id }: { module: string; id: string }) {
  const q = useQuery({ queryKey: ["zuzuu", "item", module, id], queryFn: () => dataProvider.getOne(module, id) });
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });

  if (q.isLoading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  if (q.isError || !q.data) return <div className="grid h-full place-items-center"><Text tone="muted">couldn’t load this record</Text></div>;

  const item = q.data;
  const props = propertyStack(item, fieldsFromSchema(schema.data?.schema));
  // Provenance (U6 / R6): if this note was mined, name the session(s) it was born
  // from. A session LINK, not a transcript-offset jump (the locator is session-ids-
  // only today). Degrades silently for a hand-authored / pre-U4 note (no source).
  const prov = provenanceOf(item.source);

  return (
    <div className="h-full overflow-y-auto p-10">
      <Stack gap="xl">
        <Stack gap="xs">
          <Inline gap="sm">
            <Text size="meta" tone="muted">{item.kind}</Text>
            {item.status && <Text size="meta" tone="muted">· {item.status}</Text>}
          </Inline>
          <Text size="lg" weight="semibold" font="display">{item.title || item.id}</Text>
        </Stack>
        {props.length > 0 && (
          <Stack gap="sm">
            {props.map((p) => (
              <Inline key={p.name} gap="sm" align="start">
                <div className="w-32 shrink-0"><Text size="meta" tone="muted">{p.label}</Text></div>
                <div className="min-w-0 flex-1 text-ui">
                  <Cell d={describeCell((item as unknown as Record<string, unknown>)[p.name], p.name, p.type)} />
                </div>
              </Inline>
            ))}
          </Stack>
        )}
        {item.body && (
          <div className="rounded-ui border border-border bg-surface p-4 text-ui">
            <Markdown>{item.body}</Markdown>
          </div>
        )}
        {prov && (
          <Stack gap="xs">
            <Text size="meta" tone="subtle" weight="semibold">{prov.label.toUpperCase()}</Text>
            <Inline gap="xs" wrap align="center">
              {prov.display.map((s, i) => <Chip key={prov.sessions[i] ?? s} label={s} tone="neutral" />)}
            </Inline>
          </Stack>
        )}
      </Stack>
    </div>
  );
}

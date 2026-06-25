// shell/stage/Record.tsx — the row stage: one note, read view (R14). Title + kind/
// status, its scalar frontmatter fields, then the body. The editable FieldType form
// rides in the wing (T2.4) for the same row selection. Loads via the DataProvider's
// getOne; thin (formatting is the field registry). Static utilities only.
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "../../data/provider.js";
import { Stack, Inline, Text } from "../../ds/index.js";

// shown specially (title/kind/status) or elsewhere (body); the rest render as fields
const HIDE = new Set(["id", "module", "kind", "title", "status", "body"]);

export function Record({ module, id }: { module: string; id: string }) {
  const q = useQuery({ queryKey: ["zuzuu", "item", module, id], queryFn: () => dataProvider.getOne(module, id) });

  if (q.isLoading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  if (q.isError || !q.data) return <div className="grid h-full place-items-center"><Text tone="muted">couldn’t load this record</Text></div>;

  const item = q.data;
  const rec = item as unknown as Record<string, unknown>;
  const fields = Object.keys(rec).filter((k) => !HIDE.has(k) && rec[k] != null && typeof rec[k] !== "object");

  return (
    <div className="h-full overflow-y-auto p-10">
      <Stack gap="xl">
        <Stack gap="xs">
          <Inline gap="sm">
            <Text size="meta" tone="muted">{item.kind}</Text>
            {item.status && <Text size="meta" tone="muted">· {item.status}</Text>}
          </Inline>
          <Text size="body" weight="semibold">{item.title || item.id}</Text>
        </Stack>
        {fields.length > 0 && (
          <Stack gap="sm">
            {fields.map((k) => (
              <Inline key={k} gap="sm" align="start">
                <div className="w-32 shrink-0"><Text size="meta" tone="muted">{k}</Text></div>
                <Text size="ui" tone="subtle">{String(rec[k])}</Text>
              </Inline>
            ))}
          </Stack>
        )}
        {item.body && (
          <div className="whitespace-pre-wrap rounded-ui border border-border bg-surface p-4 text-ui text-subtle">{item.body}</div>
        )}
      </Stack>
    </div>
  );
}

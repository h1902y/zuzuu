// shell/stage/Record.tsx — the row stage: one note, read view (R14). §H.6 retrofit:
// renders the SAME NoteDocument every other detail container uses (the omnibar
// panel · the row-expansion inline) instead of a bespoke property stack — one
// detail grammar, one place to improve it. Loads via getOne + the module schema;
// thin. Static utilities only.
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "../../data/provider.js";
import { api } from "../../lib/api.js";
import { fieldsFromSchema } from "./schema-fields.js";
import { NoteDocument } from "../../note/NoteDocument.js";
import { Text } from "../../ds/index.js";

export function Record({ module, id }: { module: string; id: string }) {
  const q = useQuery({ queryKey: ["zuzuu", "item", module, id], queryFn: () => dataProvider.getOne(module, id) });
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });

  if (q.isLoading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  if (q.isError || !q.data) return <div className="grid h-full place-items-center"><Text tone="muted">couldn’t load this record</Text></div>;

  return (
    <div className="h-full overflow-y-auto p-10">
      <NoteDocument item={q.data} fields={fieldsFromSchema(schema.data?.schema)} width="panel" />
    </div>
  );
}

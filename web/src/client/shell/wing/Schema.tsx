// shell/wing/Schema.tsx — the module wing: its per-module generations (the content-
// addressed lineage) + rollback (R15). Active generation is marked; any prior one can
// be restored (a pointer-flip + content restore). Built on api.zuzuu.generations /
// rollback. Static utilities only. (Declared-field schema editing → a later rung.)
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { toast } from "../../state/toast.js";
import { Stack, Inline, Text, Button } from "../../ds/index.js";

export function Schema({ module }: { module: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["zuzuu", "generations", module], queryFn: () => api.zuzuu.generations(module) });

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
    </div>
  );
}

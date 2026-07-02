// shell/wing/Schema.tsx — the module wing: its declared COLUMNS (§H.5's schema
// card — the contract, visible: name · type · required · default · description ·
// ƒ formula) + its per-module generation LINEAGE STRIP (§G.2 — teach the
// substrate): a compact horizontal strip (n · relative mintedAt · from-count),
// current highlighted. Clicking a chip opens its detail: "what changed" (the
// real gen.diff route) + a QUIET rollback hint — rollback is destructive, so
// it stays a canned omnibar-invocation hint this pass, never a wired button
// (the capability still rides api.zuzuu.rollback for a future omnibar wiring).
// Columns are READ-ONLY (§H.6 doctrine): edit via the grid's header caret or
// "+ column" toolbar (FieldConfigPanel), never a second write surface.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitCompare } from "lucide-react";
import type { GenerationSummary } from "#shared/index.js";
import { api } from "../../lib/api.js";
import { relativeTimeFromIso } from "../../lib/time.js";
import { fieldsFromSchema } from "../stage/schema-fields.js";
import { TypeGlyph } from "../stage/TypeGlyph.js";
import { Stack, Inline, Text, Icon, Box } from "../../ds/index.js";

const STATUS_TONE: Record<string, "accent" | "danger" | "subtle"> = { A: "accent", D: "danger", M: "subtle" };

/** §G.2's "what changed" panel: which notes were added/modified/deleted between
 *  the previous generation and this one — the real `gen diff` route, fetched
 *  only once its chip is opened. */
function GenerationDiff({ module, from, to }: { module: string; from: string; to: string }) {
  const q = useQuery({ queryKey: ["zuzuu", "gen-diff", module, from, to], queryFn: () => api.zuzuu.generationDiff(module, from, to) });
  if (q.isLoading) return <Text size="meta" tone="muted">diffing gen {from} → {to}…</Text>;
  const d = q.data;
  if (!d || d.degraded) return <Text size="meta" tone="muted">nothing to compare (gen {from} has no backing commit)</Text>;
  if (!d.changes.length) return <Text size="meta" tone="muted">no note changed between gen {from} and {to}</Text>;
  return (
    <Stack gap="none">
      {d.changes.slice(0, 20).map((c, i) => (
        <Inline key={`${c.id}-${i}`} gap="sm">
          <Text size="meta" mono tone={STATUS_TONE[c.status] ?? "muted"}>{c.status}</Text>
          <Text size="meta" tone="muted">{c.id}</Text>
        </Inline>
      ))}
      {d.changes.length > 20 && <Text size="meta" tone="muted">+{d.changes.length - 20} more</Text>}
    </Stack>
  );
}

/** One strip chip: `gen N`, active highlighted, relative mint time, a from-count
 *  when the generation carries `mintedFrom` (the closest thing to a "label" the
 *  ledger entry carries — see src/notes/generation.mjs, no separate label field). */
function GenerationChip({ g, active, open, onToggle, nowMs }: {
  g: GenerationSummary; active: boolean; open: boolean; onToggle: () => void; nowMs: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={g.mintedAt ?? "mint time not recorded"}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-ui border px-2 py-1 text-meta transition-colors ${
        active ? "border-accent-dim bg-selected text-ink-100" : "border-border text-subtle hover:bg-hover"
      } ${open ? "ring-1 ring-accent-dim" : ""}`}
    >
      <span className="font-mono">gen {g.id}</span>
      {active && <span>· active</span>}
      <span className="text-muted">{relativeTimeFromIso(g.mintedAt, nowMs, "time not recorded")}</span>
      {g.mintedFrom.length > 0 && <span className="text-muted">· from {g.mintedFrom.length}</span>}
    </button>
  );
}

export function Schema({ module }: { module: string }) {
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });
  const q = useQuery({ queryKey: ["zuzuu", "generations", module], queryFn: () => api.zuzuu.generations(module) });
  const fields = fieldsFromSchema(schema.data?.schema);
  const [openGen, setOpenGen] = useState<string | null>(null);

  if (q.isLoading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  const data = q.data;
  const nowMs = Date.now();
  const openIdx = data ? data.generations.findIndex((g) => g.id === openGen) : -1;
  const openG = openIdx >= 0 ? data!.generations[openIdx] : null;
  const prevG = openIdx > 0 ? data!.generations[openIdx - 1] : null;

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
          {/* §G.3 — the contract, visible: the schema card names its own file. */}
          <Text size="meta" tone="muted">this is a plain file — {module}/module.md</Text>
        </Stack>

        <Stack gap="md">
          <Text size="meta" tone="subtle" weight="semibold">GENERATIONS</Text>
          {!data || !data.generations.length ? (
            <Text size="meta" tone="muted">no generations yet</Text>
          ) : (
            <Stack gap="sm">
              <Inline gap="xs" wrap>
                {data.generations.map((g) => (
                  <GenerationChip
                    key={g.id}
                    g={g}
                    active={g.id === data.active}
                    open={g.id === openGen}
                    onToggle={() => setOpenGen(openGen === g.id ? null : g.id)}
                    nowMs={nowMs}
                  />
                ))}
              </Inline>

              {openG && (
                <Box pad="sm" bg="surface" border="hairline" radius="ui">
                  <Stack gap="sm">
                    {/* rollback: a QUIET hint, never a wired button here — destructive
                        (§G.2's explicit call). The capability itself still lives at
                        api.zuzuu.rollback for a future real omnibar invocation. */}
                    {openG.id !== data.active && (
                      <Text
                        size="meta" tone="muted" mono
                        title="rollback is destructive — this pass shows the invocation it maps to, not a button; run it from the omnibar (⌘K) once wired"
                      >
                        {`> gen rollback ${module} ${openG.id}`}
                      </Text>
                    )}
                    <Stack gap="xs">
                      <Inline gap="xs" align="center">
                        <Icon icon={GitCompare} size={11} />
                        <Text size="meta" tone="subtle" weight="semibold">WHAT CHANGED</Text>
                      </Inline>
                      {prevG ? (
                        <GenerationDiff module={module} from={prevG.id} to={openG.id} />
                      ) : (
                        <Text size="meta" tone="muted">the first generation — nothing minted before it to compare</Text>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
    </div>
  );
}

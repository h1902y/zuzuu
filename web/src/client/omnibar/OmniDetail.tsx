// src/client/omnibar/OmniDetail.tsx — the shell's DETAIL pane (§E.1 surface 3):
// list + detail side-by-side. Renders what the focused row references — a note's
// preview, a module's schema card, a proposal's change, a session's summary —
// fetched lazily per kind (react-query caches per key, so arrowing around is
// cheap). Read-only; the row's actions do the acting.
import { useQuery } from "@tanstack/react-query";
import type { StagedSummary } from "#shared/index.js";
import { api } from "../lib/api.js";
import { useWorkbench } from "../state/store.js";
import { fieldsFromSchema } from "../shell/stage/schema-fields.js";
import { NoteDocument } from "../note/NoteDocument.js";
import type { DetailRef } from "./omni-shell.js";
import type { StagedRow } from "./omni-sources.js";

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex gap-2 text-meta">
    <span className="w-14 shrink-0 text-muted">{k}</span>
    <span className="min-w-0 truncate text-subtle">{v}</span>
  </div>
);

// §H.6 retrofit: the panel's note preview is the SAME NoteDocument the Record
// stage and row-expansion render, at its "panel" width — one detail grammar,
// every container. Fields are fetched too (not just the item) so schema groups
// (select pills, ƒ formulas) render here exactly as elsewhere.
function NoteDetail({ module, id }: { module: string; id: string }) {
  const q = useQuery({ queryKey: ["zuzuu", "item", module, id], queryFn: () => api.zuzuu.item(module, id) });
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });
  if (!q.data) return <p className="text-meta text-muted">{q.isLoading ? "loading…" : "not found"}</p>;
  return <NoteDocument item={q.data} fields={fieldsFromSchema(schema.data?.schema)} width="panel" />;
}

function ModuleDetail({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["zuzuu", "schema", id], queryFn: () => api.zuzuu.schema(id) });
  const fields = ((q.data?.schema as { fields?: { name: string; type: string; required?: boolean }[] } | null)?.fields) ?? [];
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <p className="text-ui font-semibold text-ink-100">{id}</p>
      <Row k="table" v={fields.length ? `${fields.length} typed column(s)` : "schemaless"} />
      {fields.slice(0, 8).map((f) => (
        <Row key={f.name} k={f.name} v={`${f.type}${f.required ? " · required" : ""}`} />
      ))}
    </div>
  );
}

function ProposalDetail({ module, id, staged }: { module: string; id: string; staged: StagedRow[] }) {
  const s: StagedSummary | undefined = staged.find((r) => r.module === module && r.s.id === id)?.s;
  if (!s) return <p className="text-meta text-muted">gone — the queue moved on</p>;
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <p className="truncate text-ui font-semibold text-ink-100">{s.title || s.target || s.id}</p>
      <Row k="op" v={s.op ?? "change"} />
      <Row k="module" v={module} />
      {s.target && <Row k="target" v={s.target} />}
      {s.preview && <pre className="mt-1 max-h-40 overflow-hidden whitespace-pre-wrap text-meta text-subtle">{s.preview}</pre>}
      {s.rationale && <p className="text-meta text-muted">why: {s.rationale}</p>}
    </div>
  );
}

function SessionDetail({ id }: { id: string }) {
  const sessions = useWorkbench((s) => s.sessions);
  const s = sessions.find((x) => x.id === id);
  if (!s) return <p className="text-meta text-muted">session gone</p>;
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <p className="truncate text-ui font-semibold text-ink-100">{s.title ?? s.id}</p>
      <Row k="state" v={s.alive ? "live" : "ended"} />
      <Row k="id" v={s.id} />
    </div>
  );
}

export function OmniDetail({ detail, staged }: { detail: DetailRef; staged: StagedRow[] }) {
  switch (detail.kind) {
    case "note": return <NoteDetail module={detail.module} id={detail.id} />;
    case "module": return <ModuleDetail id={detail.id} />;
    case "proposal": return <ProposalDetail module={detail.module} id={detail.id} staged={staged} />;
    case "session": return <SessionDetail id={detail.id} />;
  }
}

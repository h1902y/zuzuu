// src/client/panel/ModuleView.tsx — one module drilled in.
//
// Its pending proposals (the human gate — approve/reject, CLI-shelled by the
// daemon), its items, and its per-module generation lineage (rollback to a past
// pin). Every mutation re-reads the brain (invalidate the zuzuu query tree).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Centered, PanelHeader } from "./kit.js";

export function ModuleView({ module, onBack }: { module: string; onBack: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["zuzuu", "module", module], queryFn: () => api.zuzuu.module(module) });
  const gens = useQuery({ queryKey: ["zuzuu", "gens", module], queryFn: () => api.zuzuu.generations(module) });

  const after = (p: Promise<unknown>) => void p.catch(() => {}).then(() => qc.invalidateQueries({ queryKey: ["zuzuu"] }));

  if (detail.isLoading) return <Shell module={module} onBack={onBack}><Centered>loading {module}…</Centered></Shell>;
  if (detail.isError || !detail.data) return <Shell module={module} onBack={onBack}><Centered>could not read {module}</Centered></Shell>;

  const { items, proposals } = detail.data;

  return (
    <Shell module={module} onBack={onBack}>
      <div className="flex-1 overflow-y-auto">
        {proposals.length > 0 && (
          <Section label={`proposals · ${proposals.length}`}>
            {proposals.map((p) => (
              <div key={p.id} className="border-b border-border px-3 py-2">
                <div className="text-ui text-ink-100">{p.title}</div>
                {p.preview && <div className="mt-0.5 truncate text-meta text-muted">{p.preview}</div>}
                <div className="mt-1.5 flex items-center gap-3">
                  <button onClick={() => after(api.zuzuu.approve(p.id))} className="text-meta text-accent hover:underline">approve</button>
                  <button onClick={() => after(api.zuzuu.reject(p.id))} className="text-meta text-muted hover:text-danger">reject</button>
                  {p.confidence && <span className="ml-auto text-meta text-muted">{p.confidence}</span>}
                </div>
              </div>
            ))}
          </Section>
        )}

        <Section label={`items · ${items.length}`}>
          {items.length === 0 && <Empty>nothing here yet — the loop grows it from your sessions</Empty>}
          {items.map((it) => (
            <div key={it.id} className="border-b border-border px-3 py-1.5">
              <span className="text-ui text-subtle">{it.title}</span>
              <span className="ml-2 text-meta text-muted">{it.kind}</span>
            </div>
          ))}
        </Section>

        {gens.data && gens.data.generations.length > 0 && (
          <Section label="generations">
            {gens.data.generations.map((g) => (
              <div key={g.id} className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-meta">
                <span className={g.id === gens.data!.active ? "text-accent" : "text-muted"}>
                  {g.id === gens.data!.active ? "● " : "○ "}{g.id}
                </span>
                {g.id !== gens.data!.active && (
                  <button onClick={() => after(api.zuzuu.rollback(module, g.id))} className="ml-auto text-muted hover:text-subtle">roll back</button>
                )}
              </div>
            ))}
          </Section>
        )}
      </div>
    </Shell>
  );
}

function Shell({ module, onBack, children }: { module: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={module} onBack={onBack} />
      {children}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-surface px-3 py-1 text-meta uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-3 text-meta text-muted">{children}</div>;
}

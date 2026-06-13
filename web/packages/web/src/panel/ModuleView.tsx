import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModuleKey, ProposalSummary } from "@zuzuu-web/protocol";
import { describeZuzuuError, zuzuuApi } from "../lib/zuzuu-api";
import { useExplorer } from "../state/explorer";
import { useRightPanel } from "../state/right-panel";
import { confirm } from "../components/ui";
import { ProposalRow } from "./ProposalRow";
import { ItemRow, Section, TeachingEmpty, moduleDisplay } from "./kit";
import { moduleItemPath, moduleReadmePath, moduleSchemaPath } from "./module-paths";

const openInEditor = (path: string) => useExplorer.getState().openPreviewPath(path);

const HINT_KEY = "zuzuu.hint.graduation";
const readHintDismissed = (): boolean => {
  try { return localStorage.getItem(HINT_KEY) === "1"; } catch { return true; }
};

/** One module's drill-in (slides over the dashboard): pending proposals
 *  first (inline ✓/✗ — the same mutations as the review ceremony), then the
 *  envelope items (click → the item's .md in the editor), then schema/README
 *  links. TeachingEmpty when bare. */
export function ModuleView({ moduleKey }: { moduleKey: ModuleKey }) {
  const queryClient = useQueryClient();
  const closeDrill = useRightPanel((s) => s.closeDrill);
  const [err, setErr] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(readHintDismissed);
  // display = the manifest ui descriptor when the overview has it (the
  // shared cache), built-in MODULE_META as the fallback
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: zuzuuApi.overview, refetchInterval: 8000 });
  const display = moduleDisplay(moduleKey, overview.data?.modules.find((f) => f.id === moduleKey));
  const detail = useQuery({
    queryKey: ["zuzuu", "module", moduleKey],
    queryFn: () => zuzuuApi.module(moduleKey),
    refetchInterval: 4000,
  });

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      void queryClient.invalidateQueries({ queryKey: ["zuzuu"] });
    } catch (e) {
      setErr(describeZuzuuError(e));
    }
  };

  // The actions module's pending list is its inbox — those go through act
  // approve/reject by slug; every other module through the proposal routes.
  const approve = (p: ProposalSummary) =>
    void run(() => (moduleKey === "actions" ? zuzuuApi.approveAction(p.id) : zuzuuApi.approveProposal(p.id, p.module)));
  const reject = async (p: ProposalSummary) => {
    const ok = await confirm({ title: "Reject proposal?", message: p.title, okLabel: "Reject", danger: true });
    if (!ok) return;
    void run(() => (moduleKey === "actions" ? zuzuuApi.rejectAction(p.id) : zuzuuApi.rejectProposal(p.id, p.module)));
  };

  const dismissHint = () => {
    setHintDismissed(true);
    try { localStorage.setItem(HINT_KEY, "1"); } catch { /* private mode */ }
  };

  const proposals = detail.data?.proposals ?? [];
  const items = detail.data?.items ?? [];
  const errors = detail.data?.errors ?? [];
  const bare = proposals.length === 0 && items.length === 0 && errors.length === 0;

  return (
    <div className="wc-slide-in flex flex-col gap-4 p-3">
      {/* back to the dashboard root */}
      <div className="flex items-center gap-2">
        <button
          onClick={closeDrill}
          className="text-meta text-ink-500 transition-colors hover:text-accent"
          title="Back to all modules"
        >
          ‹ All modules
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-ui font-medium text-ink-100">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-300" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d={display.icon} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {display.label}
        </span>
      </div>

      {/* educative one-time hint */}
      {!hintDismissed && (
        <div className="flex items-start gap-2 rounded-ui border border-border bg-surface p-card-sm text-meta text-ink-400">
          <span className="min-w-0">items graduate through review — nothing changes without your approval</span>
          <button onClick={dismissHint} className="ml-auto shrink-0 text-ink-600 hover:text-ink-300" title="Dismiss">
            ✕
          </button>
        </div>
      )}

      {bare ? (
        <TeachingEmpty display={display} />
      ) : (
        <>
          {/* pending first — the human gate is the panel's headline */}
          {proposals.length > 0 && (
            <Section label={`pending proposals (${proposals.length})`}>
              <div className="flex flex-col">
                {proposals.map((p) => (
                  <ProposalRow key={p.id} data={p} onApprove={() => approve(p)} onReject={() => void reject(p)} />
                ))}
              </div>
            </Section>
          )}

          <Section label={`items (${items.length})`}>
            {items.length === 0 ? (
              <div className="text-meta text-ink-600">none yet — approved proposals land here</div>
            ) : (
              <div className="flex flex-col">
                {items.map((it) => (
                  <ItemRow
                    key={it.id}
                    kind={it.kind}
                    title={it.title}
                    status={it.status === "archived" ? "archived" : undefined}
                    timestamp={it.updated_at ?? it.created_at}
                    onClick={() => openInEditor(moduleItemPath(moduleKey, it.id))}
                    titleAttr={moduleItemPath(moduleKey, it.id)}
                  />
                ))}
              </div>
            )}
          </Section>

          {errors.length > 0 && (
            <Section label={`unparseable (${errors.length})`}>
              {errors.map((e) => (
                <div key={e.file} className="truncate text-meta text-danger" title={e.error}>
                  ✗ {e.file}: {e.error}
                </div>
              ))}
            </Section>
          )}
        </>
      )}

      {err && <div className="break-all font-mono text-meta text-danger">{err}</div>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => openInEditor(moduleSchemaPath(moduleKey))}
          className="text-meta text-ink-500 hover:text-accent"
          title={moduleSchemaPath(moduleKey)}
        >
          schema.json ›
        </button>
        <button
          onClick={() => openInEditor(moduleReadmePath(moduleKey))}
          className="text-meta text-ink-500 hover:text-accent"
          title={moduleReadmePath(moduleKey)}
        >
          module README ›
        </button>
      </div>
    </div>
  );
}

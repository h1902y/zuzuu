// src/client/panel/ModulesDashboard.tsx — the zuzuu surface (modules mode).
//
// The five-module grid (the cards ARE the navigation — click to drill in via
// ModuleView). Reads /api/zuzuu/overview in one call. When zuzuu isn't set up
// in this workspace, it teaches the next step rather than erroring.

import { useQuery } from "@tanstack/react-query";
import { usePanel } from "../state/panel.js";
import { api } from "../lib/api.js";
import { toTiles } from "./dashboard-data.js";
import { ModuleView } from "./ModuleView.js";
import { Centered, PanelHeader } from "./kit.js";

export function ModulesDashboard() {
  const module = usePanel((s) => s.module);
  const openModule = usePanel((s) => s.openModule);
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview, retry: false });

  if (module) return <ModuleView module={module} onBack={() => openModule(null)} />;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="modules" />
      {overview.isLoading ? (
        <Centered>reading the zuzuu…</Centered>
      ) : overview.isError || !overview.data ? (
        <Centered>no <code className="text-subtle">.zuzuu/</code> here yet — run <code className="text-subtle">zz init</code> in the terminal</Centered>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto p-3">
          {toTiles(overview.data).map((t) => (
            <button
              key={t.key}
              onClick={() => openModule(t.key)}
              className={`rounded-ui border border-border bg-app p-3 text-left transition-colors hover:border-accent-dim ${t.enabled ? "" : "opacity-50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-ui text-ink-100">{t.title}</span>
                {t.pending > 0 && (
                  <span className="rounded-full bg-accent-dim px-2 py-0.5 text-meta text-accent">{t.pending} pending</span>
                )}
              </div>
              {t.tagline && <p className="mt-1 line-clamp-2 text-meta text-muted">{t.tagline}</p>}
              <div className="mt-2 text-meta text-muted">
                {t.items} item{t.items === 1 ? "" : "s"}{t.errors ? ` · ${t.errors} error${t.errors === 1 ? "" : "s"}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

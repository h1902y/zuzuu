// WS-C — the modules MASTER list (right column).
//
// One row per module (N modules, not just five): a hue dot + the module name
// (sans) + a meta line (item count · kind) + an insight-count badge (= pending,
// only when >0) + an on/off Switch bound to `enabled`. Clicking a row opens
// that module's detail in the CENTER (openModule). A "＋ New module" button
// stubs guided creation (WS-D). Brutal-minimal: flat, sharp, strong row
// separators via border-border; disabled modules render dimmed but stay listed.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModuleOverviewEntry, ModuleOverviewResponse } from "@zuzuu-web/protocol";
import { zuzuuApi } from "../lib/zuzuu-api";
import { useRightPanel } from "../state/right-panel";
import { Switch } from "../components/ui-shadcn/switch";
import { Badge } from "../components/ui-shadcn/badge";
import { Button } from "../components/ui-shadcn/button";
import { ScrollArea } from "../components/ui-shadcn/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui-shadcn/dialog";
import { moduleDisplay, moduleHue } from "./kit";
import { kindLabel, orderedIds, toggleEnabledInOverview } from "./modules-list";

export function ModulesList({
  zuzuuHome,
  zuzuuBin,
  onCollapse,
}: {
  zuzuuHome: boolean;
  zuzuuBin: boolean;
  onCollapse: () => void;
}) {
  const overview = useQuery({
    queryKey: ["zuzuu", "overview"],
    queryFn: zuzuuApi.overview,
    refetchInterval: 8000,
  });
  const [newOpen, setNewOpen] = useState(false);

  const entries = overview.data?.modules ?? [];
  const ids = orderedIds(entries);

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {/* header: "Modules" + count + collapse */}
      <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
        <span className="font-sans text-label font-[560] uppercase tracking-[0.09em] text-muted-foreground">Modules</span>
        {ids.length > 0 && (
          <span className="wc-mono text-meta text-muted-foreground">{ids.length}</span>
        )}
        <button
          onClick={onCollapse}
          title="Collapse panel"
          className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {!zuzuuHome ? (
        <EmptyState zuzuuBin={zuzuuBin} />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          {/* the clean vertical list — strong row separators, no cards */}
          <ul className="flex flex-col border-b border-[var(--border)]">
            {ids.map((id) => {
              const entry = entries.find((e) => e.id === id);
              return <ModuleRow key={id} id={id} entry={entry} />;
            })}
          </ul>

          {/* ＋ New module (stub → WS-D) */}
          <div className="p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5"
              onClick={() => setNewOpen(true)}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 3v10M3 8h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              New module
            </Button>
          </div>
        </ScrollArea>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guided module creation</DialogTitle>
            <DialogDescription>
              Coming soon — you&apos;ll be able to compose a new module from a
              template and let it grow from your sessions.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** One module master row. */
function ModuleRow({ id, entry }: { id: string; entry: ModuleOverviewEntry | undefined }) {
  const openModule = useRightPanel((s) => s.openModule);
  const selectedModule = useRightPanel((s) => s.selectedModule);
  const queryClient = useQueryClient();

  const display = moduleDisplay(id, entry);
  const hue = moduleHue(id);
  const items = entry?.counts.items ?? 0;
  const pending = entry?.counts.pending ?? 0;
  const enabled = entry?.enabled ?? true;
  const selected = selectedModule === id;

  // optimistic toggle: patch the overview cache, fire the mutation, roll back
  // on error, then invalidate to reconcile with the daemon.
  const toggle = useMutation({
    mutationFn: (next: boolean) => zuzuuApi.setModuleEnabled(id, next),
    onMutate: async (next: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["zuzuu", "overview"] });
      const prev = queryClient.getQueryData(["zuzuu", "overview"]);
      queryClient.setQueryData(["zuzuu", "overview"], (old: ModuleOverviewResponse | undefined) =>
        toggleEnabledInOverview(old, id, next),
      );
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["zuzuu", "overview"], ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["zuzuu", "overview"] });
    },
  });

  return (
    <li
      className={[
        "group flex items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 transition-colors last:border-0",
        selected ? "bg-[var(--accent)]" : "hover:bg-[var(--accent)]",
        !enabled && "opacity-50",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* the row body is the open affordance */}
      <button
        onClick={() => openModule(id as Parameters<typeof openModule>[0])}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        title={`Open ${display.label}`}
      >
        {/* hue dot */}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: hue }}
          aria-hidden
        />
        <span className="flex min-w-0 flex-col">
          <span className="wc-sans truncate text-ui font-medium text-foreground">{display.label}</span>
          <span className="wc-sans truncate text-meta text-muted-foreground">
            {items} {items === 1 ? "item" : "items"} · {kindLabel(entry)}
          </span>
        </span>
      </button>

      {/* insight count badge — pending proposals awaiting review */}
      {pending > 0 && (
        <Badge
          variant="secondary"
          className="shrink-0 rounded-full px-2 py-0 text-meta font-semibold"
          title={`${pending} proposal${pending === 1 ? "" : "s"} awaiting review`}
        >
          {pending}
        </Badge>
      )}

      {/* on/off toggle */}
      <Switch
        checked={enabled}
        disabled={toggle.isPending}
        onCheckedChange={(next) => toggle.mutate(next)}
        aria-label={`${enabled ? "Disable" : "Enable"} ${display.label}`}
        title={enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
        className="shrink-0"
      />
    </li>
  );
}

/** No zuzuu home yet — the center pane owns setup; the list stays quiet. */
function EmptyState({ zuzuuBin }: { zuzuuBin: boolean }) {
  return (
    <div className="flex flex-col gap-2 p-4 text-ui leading-relaxed text-muted-foreground">
      <div className="text-foreground">No zuzuu home in this project yet.</div>
      <p>
        Once set up, your agent&apos;s modules — knowledge, memory, actions,
        instructions, guardrails — live here and grow from real sessions.
      </p>
      {!zuzuuBin && (
        <p className="text-meta">
          zuzuu CLI required — <code className="text-warn">npm i -g @zuzuucodes/cli</code>
        </p>
      )}
    </div>
  );
}

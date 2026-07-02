// src/client/palette/PaletteBody.tsx — the ⌘K omnibar SHELL (lazy). §E.1: not just an
// input — a view-stack spotlight. The root list is nouns + commands (fixed groups
// Navigate · Actions · Switch project · Sessions · Tables + the live Notes group, all
// registry rows); Tab on a focused noun pushes its ACTION PANEL; Esc pops (never
// closes-by-surprise); the breadcrumb lives in the placeholder; rows carry the
// two-lane grammar (instant vs proposal — the moat readable at the input) + a hint
// column. cmdk owns keyboard + selection, fuzzyScore the ranking, and a typed
// dispatcher drives the stores. Outside the ds-no-inline scan, so cmdk's arbitrary
// classes are fine here.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Command } from "cmdk";
import { useWorld } from "../shell/world-state.js";
import { useWorkbench } from "../state/store.js";
import { useReview } from "../state/review.js";
import { useStartSession } from "../shell/session/use-start-session.js";
import { useEnterProject } from "../shell/session/use-enter-project.js";
import { useAppSurface } from "../state/app-surface.js";
import { HOSTS } from "../app/hosts.js";
import { api } from "../lib/api.js";
import { dataProvider } from "../data/provider.js";
import { newNoteId } from "../shell/stage/stage-header.js";
import { toast } from "../state/toast.js";
import { paletteFilterScore } from "./palette-logic.js";
import { buildPaletteGroups, omniGroup, type PaletteAction, type PaletteCommand, type PaletteGroup } from "./palette-commands.js";
import { notesGroup } from "./palette-rank.js";
import { useWorldCommand } from "../state/world-command.js";
import { useAcpIntent } from "../state/acp-intent.js";
import { useModuleView } from "../state/module-view.js";
import { emptyStack, push, pop, top, placeholderFor, hintFor, laneBadge, type OmniStack } from "../omnibar/omni-shell.js";
import { proposalsGroup, viewsGroup, type StagedRow } from "../omnibar/omni-sources.js";
import { OmniDetail } from "../omnibar/OmniDetail.js";
import { AcpConversation } from "../shell/stage/AcpView.js";
import { useModuleFilter } from "../state/module-filter.js";

export default function PaletteBody() {
  const setPalette = useWorld((s) => s.setPalette);
  const select = useWorld((s) => s.select);
  const selected = useWorld((s) => s.selected);
  const sessions = useWorkbench((s) => s.sessions);
  const acpSessions = useWorkbench((s) => s.acpSessions);
  const registerAcp = useWorkbench((s) => s.registerAcp);
  const requestWorld = useWorldCommand((s) => s.request);
  const queuePrompt = useAcpIntent((s) => s.set);
  const setReview = useReview((s) => s.setOpen);
  const startSession = useStartSession();
  const enterProject = useEnterProject();
  const goHome = useAppSurface((s) => s.home);
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [stack, setStack] = useState<OmniStack>(emptyStack);
  const [focusVal, setFocusVal] = useState("");
  const view = top(stack);

  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const recents = useQuery({ queryKey: ["projects", "recents"], queryFn: api.projects.recents });

  // The Notes (content) group: fetch every module's notes once per palette session
  // (cached), then filter client-side per keystroke via notesGroup → searchNotes.
  const ids = (overview.data?.modules ?? []).map((m) => m.id);
  const notesQuery = useQuery({
    queryKey: ["zuzuu", "all-notes", ids],
    enabled: ids.length > 0,
    // one fan-out feeds THREE sources: the Notes content group, the saved Views
    // group (type:view notes), and each module's pending proposals
    queryFn: async () => {
      const details = await Promise.all(ids.map((id) => api.zuzuu.module(id)));
      return {
        items: details.flatMap((d) => d.items),
        staged: details.flatMap((d) => d.staged.map((s) => ({ module: d.key, s }))),
      };
    },
  });
  const notesLoading = ids.length > 0 && notesQuery.isLoading;
  const allItems = notesQuery.data?.items ?? [];
  const staged: StagedRow[] = notesQuery.data?.staged ?? [];

  const groups = buildPaletteGroups({
    sessions,
    modules: overview.data?.modules ?? [],
    recents: recents.data?.recents ?? [],
    hosts: HOSTS,
  });
  const notes = notesGroup(query, allItems, notesLoading);
  const proposals = proposalsGroup(staged);
  const views = viewsGroup(allItems, query);
  // C3 — the omnibar's prefix modes take over the palette: `>` world commands,
  // `/` the conversation. Omni groups self-filter, so cmdk's filter stands down.
  const omni = omniGroup(query, overview.data?.modules ?? []);
  // audit item 7: with a live query, CONTENT leads — the notes group renders first
  // so the best note is the default Enter target (cmdk keeps DOM order for ties;
  // the exact-substring filter score already zeroes most command noise).
  // root order: querying → content first (notes · views), then commands, proposals
  // trailing; idle → what needs you first (proposals), then commands.
  const extras = [views, proposals].filter((g): g is NonNullable<typeof g> => g != null);
  const rootGroups = omni ? [omni]
    : notes && query.trim() ? [notes, ...extras, ...groups]
      : [...(proposals ? [proposals] : []), ...groups, ...(views ? [views] : []), ...(notes ? [notes] : [])];

  // A pushed ACTION PANEL replaces the root list (Raycast): one group, the noun's
  // verbs. The rows are ordinary commands, so Enter dispatches the same way.
  const allGroups: PaletteGroup[] =
    view?.kind === "actions" ? [{ heading: view.row.label, commands: view.row.actions ?? [] }] : rootGroups;

  // focused-row lookup (Tab reads it; the detail pane will too)
  const rowByValue = useMemo(() => {
    const m = new Map<string, PaletteCommand>();
    for (const g of allGroups) for (const c of g.commands) m.set(c.value, c);
    return m;
  }, [allGroups]);

  const focusedRow = rowByValue.get(focusVal);
  const detail = !view ? focusedRow?.detail : undefined;

  const close = () => setPalette(false);
  const pushView = (v: Parameters<typeof push>[1]) => { setStack((s) => push(s, v)); setQuery(""); setFocusVal(""); };
  const popView = () => { setStack(pop); setQuery(""); setFocusVal(""); };

  function dispatch(action: PaletteAction) {
    switch (action.kind) {
      case "noop": return; // the loading placeholder — keep the palette open
      case "review": setReview(true); break;
      case "overview": select({ kind: "overview" }); break;
      case "projects-home": goHome(); break;
      case "new-shell": void startSession("shell"); break;
      case "new-agent": void startSession("agent", action.host); break;
      case "open-session": select({ kind: "session", id: action.id }); break;
      case "open-module": select({ kind: "module", id: action.id }); break;
      case "switch-project": void enterProject(action.path); break;
      case "open-note":
        // map-first (C3): open in the map — the World keeps the stage, the record
        // opens as the wing, and the camera flies to the node.
        select({ kind: "note", id: action.id, module: action.module });
        requestWorld({ kind: "flyTo", addr: `${action.module}:${action.id}` });
        break;
      case "world-fit": select(null); requestWorld({ kind: "fit" }); break;
      case "world-module": select(null); requestWorld({ kind: "focusModule", module: action.id }); break;
      case "open-everything":
        // the unified table: one grid over every module (module = a column/facet)
        useModuleView.getState().set("", "table");
        select({ kind: "everything" });
        break;
      case "module-view": {
        // flip the projection of the module IN CONTEXT (selected module, or the
        // module of the focused note/row/draft; the unified Everything toggles its
        // '' scope). No context at all: >map falls back to the World home; >table
        // opens Everything — the whole Project always HAS a table now.
        const module = selected?.kind === "module" ? selected.id
          : selected?.kind === "note" || selected?.kind === "row" || selected?.kind === "draft" ? selected.module
            : null;
        if (selected?.kind === "everything") {
          useModuleView.getState().set("", action.view);
        } else if (module) {
          useModuleView.getState().set(module, action.view);
          select({ kind: "module", id: module });
        } else if (action.view === "graph") {
          select(null);
          requestWorld({ kind: "fit" });
        } else {
          useModuleView.getState().set("", "table");
          select({ kind: "everything" });
        }
        break;
      }
      case "converse": {
        // route to the EXISTING ACP drive lane (enhance, never reinvent): reuse the
        // newest registered agent session, else create one; the prompt is queued and
        // the conversation surface sends it on ready. §E.1 surface 4: chat renders
        // IN the panel (a pushed view — Esc pops, the conversation continues in the
        // background; the daemon replays its trace on reattach). The raw terminal
        // lane is untouched, and nothing auto-fires — this runs only on Enter.
        const prompt = action.prompt;
        void (async () => {
          let id = acpSessions.at(-1)?.id ?? null;
          if (!id) {
            const created = await api.acp.create().catch(() => null);
            if (!created) { toast("Couldn't start the agent (ACP) — try a terminal session", "error"); return; }
            registerAcp(created.id);
            id = created.id;
          }
          queuePrompt(prompt);
          pushView({ kind: "chat", id });
        })();
        return; // the panel stays open — chat is a pushed surface, not a hand-off
      }
      case "see-all-search": select({ kind: "search", query: action.query }); break;
      case "open-row": select({ kind: "row", module: action.module, id: action.id }); break;
      case "approve-proposal": {
        // the gate's inline decision — the human IS the gate; instant lane
        void dataProvider.approve(action.id, action.module)
          .then(() => toast("Approved — landed"))
          .catch((e) => toast(`Couldn’t approve${e instanceof Error && e.message ? ` — ${e.message}` : ""}`, "error"))
          .finally(() => void qc.invalidateQueries({ queryKey: ["zuzuu"] }));
        break;
      }
      case "reject-proposal": {
        void dataProvider.reject(action.id, action.module, "rejected from the omnibar")
          .then(() => toast("Rejected — dissolved"))
          .catch((e) => toast(`Couldn’t reject${e instanceof Error && e.message ? ` — ${e.message}` : ""}`, "error"))
          .finally(() => void qc.invalidateQueries({ queryKey: ["zuzuu"] }));
        break;
      }
      case "run-view": {
        // one filter state, two projections: apply the view's lens to its scope
        // and open the table; T flips the same lens onto the map as a spotlight.
        const scope = action.module; // '' = the Everything scope
        useModuleFilter.getState().patch(scope, { text: action.text, kind: action.noteKind, module: "" });
        useModuleView.getState().set(scope, "table");
        select(scope ? { kind: "module", id: scope } : { kind: "everything" });
        break;
      }
      case "create-note": {
        // THE INVERSION — a create stages a proposal through the review gate, never a
        // direct write. Target the selected module, else default to knowledge.
        const mod = selected?.kind === "module" ? selected.id : "knowledge";
        void dataProvider.create(mod, newNoteId(Date.now()), { title: action.query, body: "" })
          .then(() => { toast("New note staged for review"); void qc.invalidateQueries({ queryKey: ["zuzuu"] }); })
          .catch(() => toast("Couldn't stage the note", "error"));
        break;
      }
    }
    setStack(emptyStack);
    close();
  }

  // The shell's key grammar: Esc POPS a pushed view (only closes from the root);
  // Tab on a focused noun pushes its action panel. cmdk sees neither.
  function onShellKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (view) popView(); else close();
      return;
    }
    if (e.key === "Tab" && !view) {
      const row = rowByValue.get(focusVal);
      if (row?.actions?.length) { e.preventDefault(); e.stopPropagation(); pushView({ kind: "actions", row }); }
    }
  }

  return (
    <div className="animate-fade fixed inset-0 z-50 flex justify-center bg-scrim pt-[12vh]" onClick={close}>
      <Command
        label="Command palette"
        filter={omni || view ? () => 1 : paletteFilterScore}
        value={focusVal}
        onValueChange={setFocusVal}
        onKeyDown={onShellKeyDown}
        className={`animate-pop h-fit ${detail || view?.kind === "chat" ? "w-[840px]" : "w-[560px]"} max-w-[92vw] overflow-hidden rounded-ui border border-border bg-elevated shadow-overlay`}
        onClick={(e) => e.stopPropagation()}
      >
        {view?.kind !== "chat" && (
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={placeholderFor(stack)}
            className="w-full border-b border-border bg-transparent px-4 py-3 text-body text-ink-100 outline-none placeholder:text-muted"
          />
        )}
        {view?.kind === "chat" ? (
          <div className="h-[60vh]">
            <AcpConversation id={view.id} compact />
          </div>
        ) : (
        <div className="flex">
          <Command.List className={`max-h-[50vh] ${detail ? "w-[55%]" : "w-full"} overflow-y-auto p-1`}>
            <Command.Empty className="px-3 py-4 text-meta text-muted">no matches</Command.Empty>
            {allGroups.map((group) => (
              <Command.Group key={group.heading} heading={group.heading} className="px-2 py-1 text-meta text-muted">
                {group.commands.map((cmd) => (
                  <Item key={`${group.heading}:${cmd.value}`} cmd={cmd} onSelect={() => dispatch(cmd.action)} />
                ))}
              </Command.Group>
            ))}
          </Command.List>
          {detail && (
            <div className="max-h-[50vh] min-w-0 flex-1 overflow-y-auto border-l border-border p-3">
              <OmniDetail detail={detail} staged={staged} />
            </div>
          )}
        </div>
        )}
      </Command>
    </div>
  );
}

/** One row: label · quiet meta · (right) lane badge + hint — the §E.2 row grammar.
 *  The lane badge is the moat made visible: an 'instant' operator verb vs a
 *  'proposal' that the review gate will decide. */
function Item({ cmd, onSelect }: { cmd: PaletteCommand; onSelect: () => void }) {
  const badge = laneBadge(cmd.lane);
  const hint = hintFor(cmd);
  return (
    <Command.Item
      value={cmd.value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-ui text-subtle data-[selected=true]:bg-hover data-[selected=true]:text-ink-100"
    >
      <span className="truncate">{cmd.label}</span>
      {cmd.meta && <span className="shrink-0 text-meta text-muted">{cmd.meta}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {badge === "instant" && <span className="rounded-sm bg-accent-dim px-1 text-meta text-ink-100">instant</span>}
        {badge === "proposal" && <span className="rounded-sm border border-dashed border-border px-1 text-meta text-warning">proposal</span>}
        {hint && <span className="text-meta text-muted">{hint}</span>}
      </span>
    </Command.Item>
  );
}

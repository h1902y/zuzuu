// src/client/palette/PaletteBody.tsx — the ⌘K omnibar (lazy). Jump to any node + run the
// key actions + switch project (fixed groups Navigate · Actions · Switch project ·
// Sessions · Tables, tested via palette-commands), PLUS a live Notes (content) group (U3)
// appended last so commands rank above content. cmdk owns the keyboard + selection,
// fuzzyScore the ranking, and a typed dispatcher drives the stores. The Notes group is
// query-driven (notesGroup over the cached fan-out). Outside the ds-no-inline scan, so
// cmdk's arbitrary classes are fine here.
import { useState } from "react";
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
import { buildPaletteGroups, omniGroup, type PaletteAction } from "./palette-commands.js";
import { notesGroup } from "./palette-rank.js";
import { useWorldCommand } from "../state/world-command.js";
import { useAcpIntent } from "../state/acp-intent.js";
import { useModuleView } from "../state/module-view.js";

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

  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const recents = useQuery({ queryKey: ["projects", "recents"], queryFn: api.projects.recents });

  // The Notes (content) group: fetch every module's notes once per palette session
  // (cached), then filter client-side per keystroke via notesGroup → searchNotes.
  const ids = (overview.data?.modules ?? []).map((m) => m.id);
  const notesQuery = useQuery({
    queryKey: ["zuzuu", "all-notes", ids],
    enabled: ids.length > 0,
    queryFn: async () => (await Promise.all(ids.map((id) => api.zuzuu.module(id)))).flatMap((d) => d.items),
  });
  const notesLoading = ids.length > 0 && notesQuery.isLoading;

  const groups = buildPaletteGroups({
    sessions,
    modules: overview.data?.modules ?? [],
    recents: recents.data?.recents ?? [],
    hosts: HOSTS,
  });
  const notes = notesGroup(query, notesQuery.data ?? [], notesLoading);
  // C3 — the omnibar's prefix modes take over the palette: `>` world commands,
  // `/` the conversation. Omni groups self-filter, so cmdk's filter stands down.
  const omni = omniGroup(query, overview.data?.modules ?? []);
  // audit item 7: with a live query, CONTENT leads — the notes group renders first
  // so the best note is the default Enter target (cmdk keeps DOM order for ties;
  // the exact-substring filter score already zeroes most command noise).
  const allGroups = omni ? [omni] : notes && query.trim() ? [notes, ...groups] : notes ? [...groups, notes] : groups;

  const close = () => setPalette(false);

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
      case "module-view": {
        // flip the projection of the module IN CONTEXT (selected module, or the
        // module of the focused note/row/draft). No module context: >map falls back
        // to the World home (the whole map); >table has nothing to project — say so.
        const module = selected?.kind === "module" ? selected.id
          : selected?.kind === "note" || selected?.kind === "row" || selected?.kind === "draft" ? selected.module
            : null;
        if (module) {
          useModuleView.getState().set(module, action.view);
          select({ kind: "module", id: module });
        } else if (action.view === "graph") {
          select(null);
          requestWorld({ kind: "fit" });
        } else {
          toast("no table in focus — try >module <name> first");
        }
        break;
      }
      case "converse": {
        // route to the EXISTING ACP drive lane (enhance, never reinvent): reuse the
        // newest registered agent session, else create one; the prompt is queued and
        // AcpView sends it on ready. The raw terminal lane is untouched.
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
          select({ kind: "acp", id });
        })();
        break;
      }
      case "see-all-search": select({ kind: "search", query: action.query }); break;
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
    close();
  }

  return (
    <div className="animate-fade fixed inset-0 z-50 flex justify-center bg-scrim pt-[12vh]" onClick={close}>
      <Command
        label="Command palette"
        filter={omni ? () => 1 : paletteFilterScore}
        className="animate-pop h-fit w-[560px] max-w-[90vw] overflow-hidden rounded-ui border border-border bg-elevated shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="find anything · >world commands · /ask the agent"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-body text-ink-100 outline-none placeholder:text-muted"
        />
        <Command.List className="max-h-[50vh] overflow-y-auto p-1">
          <Command.Empty className="px-3 py-4 text-meta text-muted">no matches</Command.Empty>
          {allGroups.map((group) => (
            <Command.Group key={group.heading} heading={group.heading} className="px-2 py-1 text-meta text-muted">
              {group.commands.map((cmd) => (
                <Item key={`${group.heading}:${cmd.value}`} value={cmd.value} onSelect={() => dispatch(cmd.action)}>
                  {cmd.label}
                </Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

function Item({ value, onSelect, children }: { value: string; onSelect: () => void; children: React.ReactNode }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="cursor-pointer truncate rounded px-3 py-1.5 text-ui text-subtle data-[selected=true]:bg-hover data-[selected=true]:text-ink-100"
    >
      {children}
    </Command.Item>
  );
}

// src/client/palette/PaletteBody.tsx — the ⌘K omnibar (lazy). Jump to any node + run
// the key actions + switch project, in fixed groups (Navigate · Actions · Switch
// project · Sessions · Tables). The grouping/ordering/labeling is the tested
// palette-commands model; cmdk owns the keyboard + selection, our fuzzyScore the
// ranking, and a typed action dispatcher drives the stores. Lives in palette/ (outside
// the ds-no-inline scan) so cmdk's arbitrary classes are fine here.
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { useWorld } from "../shell/world-state.js";
import { useWorkbench } from "../state/store.js";
import { useReview } from "../state/review.js";
import { useStartSession } from "../shell/session/use-start-session.js";
import { useEnterProject } from "../shell/session/use-enter-project.js";
import { useAppSurface } from "../state/app-surface.js";
import { HOSTS } from "../app/hosts.js";
import { api } from "../lib/api.js";
import { fuzzyScore } from "./palette-logic.js";
import { buildPaletteGroups, type PaletteAction } from "./palette-commands.js";

export default function PaletteBody() {
  const setPalette = useWorld((s) => s.setPalette);
  const select = useWorld((s) => s.select);
  const sessions = useWorkbench((s) => s.sessions);
  const setReview = useReview((s) => s.setOpen);
  const startSession = useStartSession();
  const enterProject = useEnterProject();
  const setScreen = useAppSurface((s) => s.setScreen);
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const recents = useQuery({ queryKey: ["projects", "recents"], queryFn: api.projects.recents });

  const groups = buildPaletteGroups({
    sessions,
    modules: overview.data?.modules ?? [],
    recents: recents.data?.recents ?? [],
    hosts: HOSTS,
  });

  const close = () => setPalette(false);

  function dispatch(action: PaletteAction) {
    switch (action.kind) {
      case "review": setReview(true); break;
      case "overview": select({ kind: "overview" }); break;
      case "projects-home": setScreen("projects"); break;
      case "new-shell": void startSession("shell"); break;
      case "new-agent": void startSession("agent", action.host); break;
      case "open-session": select({ kind: "session", id: action.id }); break;
      case "open-module": select({ kind: "module", id: action.id }); break;
      case "switch-project": void enterProject(action.path); break;
    }
    close();
  }

  return (
    <div className="animate-fade fixed inset-0 z-50 flex justify-center bg-scrim pt-[12vh]" onClick={close}>
      <Command
        label="Command palette"
        filter={(value, search) => { const s = fuzzyScore(search, value); return s === null ? 0 : 1 / (1 + s); }}
        className="animate-pop h-fit w-[560px] max-w-[90vw] overflow-hidden rounded-ui border border-border bg-elevated shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          placeholder="jump to anything…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-body text-ink-100 outline-none placeholder:text-muted"
        />
        <Command.List className="max-h-[50vh] overflow-y-auto p-1">
          <Command.Empty className="px-3 py-4 text-meta text-muted">no matches</Command.Empty>
          {groups.map((group) => (
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

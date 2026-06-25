// src/client/palette/PaletteBody.tsx — the ⌘K omnibar (lazy). Jump to any node
// (session / table) + the key actions (review the gate, new shell/agent, home). cmdk
// owns the keyboard + selection; our fuzzyScore owns the ranking. Drives the
// Stage+Wings stores (world-state selection, useStartSession, useReview). Lives in
// palette/ (outside the ds-no-inline scan) so cmdk's arbitrary classes are fine here.
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { useWorld } from "../shell/world-state.js";
import { useWorkbench } from "../state/store.js";
import { useReview } from "../state/review.js";
import { useStartSession } from "../shell/session/use-start-session.js";
import { HOSTS } from "../app/hosts.js";
import { api } from "../lib/api.js";
import { fuzzyScore } from "./palette-logic.js";

export default function PaletteBody() {
  const setPalette = useWorld((s) => s.setPalette);
  const select = useWorld((s) => s.select);
  const sessions = useWorkbench((s) => s.sessions);
  const setReview = useReview((s) => s.setOpen);
  const startSession = useStartSession();
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const modules = overview.data?.modules ?? [];

  const close = () => setPalette(false);
  const run = (fn: () => void) => () => { fn(); close(); };

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
          <Command.Group heading="Actions" className="px-2 py-1 text-meta text-muted">
            <Item value="review proposals gate" onSelect={run(() => setReview(true))}>Review proposals</Item>
            <Item value="home the database" onSelect={run(() => select(null))}>Home — the database</Item>
            <Item value="new shell session" onSelect={run(() => void startSession("shell"))}>New shell</Item>
            {HOSTS.map((h) => (
              <Item key={h.id} value={`new ${h.label} agent session`} onSelect={run(() => void startSession("agent", h.id))}>
                New {h.label}
              </Item>
            ))}
          </Command.Group>
          {sessions.length > 0 && (
            <Command.Group heading="Sessions" className="px-2 py-1 text-meta text-muted">
              {sessions.map((s) => (
                <Item key={s.id} value={`session ${s.title ?? s.id}`} onSelect={run(() => select({ kind: "session", id: s.id }))}>
                  {s.title ?? s.id}
                </Item>
              ))}
            </Command.Group>
          )}
          {modules.length > 0 && (
            <Command.Group heading="Tables" className="px-2 py-1 text-meta text-muted">
              {modules.map((m) => (
                <Item key={m.id} value={`table ${m.title}`} onSelect={run(() => select({ kind: "module", id: m.id }))}>
                  {m.title}
                </Item>
              ))}
            </Command.Group>
          )}
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

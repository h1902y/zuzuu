// shell/NavTree.tsx — ONE nav tree, sessions + modules as siblings (no modes, R2).
// Sessions show liveness (● owner / • other-live / ○ idle); modules show pending.
// Selecting a node drives the stage/wing. Composed from ds primitives.
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useWorkbench } from "../state/store.js";
import { useWorld } from "./world-state.js";
import { mostRecentlyActive } from "./shell-state.js";
import { Stack, Text } from "../ds/index.js";

function NavRow({ active, dot, label, badge, onClick }: {
  active: boolean; dot: string; label: string; badge?: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-ui px-2 py-1 text-left transition-colors ${active ? "bg-selected text-ink-100" : "text-subtle hover:bg-hover hover:text-ink-100"}`}
    >
      <Text size="meta" tone={active ? "accent" : "muted"}>{dot}</Text>
      <span className="min-w-0 flex-1 truncate text-ui">{label}</span>
      {badge ? <Text size="meta" tone="accent">{badge}</Text> : null}
    </button>
  );
}

export function NavTree() {
  const sessions = useWorkbench((s) => s.sessions);
  const open = useWorkbench((s) => s.open);
  const selected = useWorld((s) => s.selected);
  const select = useWorld((s) => s.select);
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });

  const owner = mostRecentlyActive(sessions.map((s) => ({ id: s.id, live: s.alive, lastActiveAt: s.createdAt })));
  const modules = overview.data?.modules ?? [];

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-surface p-2">
      <Text as="button" size="meta" tone="muted" weight="semibold" onClick={() => select(null)}>
        ⌂ {overview.data ? "the database" : "…"}
      </Text>

      <Stack gap="xs">
        <Text size="meta" tone="subtle" weight="semibold">SESSIONS</Text>
        {sessions.map((s) => (
          <NavRow
            key={s.id}
            active={selected?.kind === "session" && selected.id === s.id}
            dot={s.alive ? (s.id === owner ? "●" : "•") : "○"}
            label={s.title || s.id}
            onClick={() => select({ kind: "session", id: s.id })}
          />
        ))}
        <Text as="button" size="meta" tone="muted" onClick={() => void open("shell")}>+ new session</Text>
      </Stack>

      <Stack gap="xs">
        <Text size="meta" tone="subtle" weight="semibold">TABLES</Text>
        {modules.map((m) => (
          <NavRow
            key={m.id}
            active={selected?.kind === "module" && selected.id === m.id}
            dot="▦"
            label={m.title}
            badge={m.counts?.pending || undefined}
            onClick={() => select({ kind: "module", id: m.id })}
          />
        ))}
      </Stack>
    </nav>
  );
}

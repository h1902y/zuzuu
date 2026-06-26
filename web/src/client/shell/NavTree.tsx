// shell/NavTree.tsx — ONE nav tree, sessions + modules as siblings (no modes, R2).
// Sessions show liveness (● owner / • other-live / ○ idle); modules show pending.
// Selecting a node drives the stage/wing. Composed from ds primitives.
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Circle, Table2, Flag, Home, Share2, Search, Settings as SettingsIcon, X, Check } from "lucide-react";
import type { SessionInfo } from "#shared/index.js";
import { api } from "../lib/api.js";
import { useWorkbench } from "../state/store.js";
import { useWorld } from "./world-state.js";
import { mostRecentlyActive } from "./shell-state.js";
import { shouldShowSetupNode } from "./project-home-state.js";
import { NewSessionMenu } from "./session/NewSessionMenu.js";
import { showCloseCardFromResult } from "./review/use-session-close.js";
import { Stack, Inline, Text, Icon } from "../ds/index.js";

function NavRow({ active, icon, label, badge, onClick }: {
  active: boolean; icon: ReactNode; label: string; badge?: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-full items-center gap-3 rounded-ui px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus ${active ? "bg-selected text-ink-100" : "text-subtle hover:bg-hover hover:text-ink-100"}`}
    >
      <span className="flex shrink-0 items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-ui">{label}</span>
      {badge ? <Text size="meta" tone="accent">{badge}</Text> : null}
    </button>
  );
}

/** A session row: a select button + an end-session ✕ (sibling, not nested). The ✕
 *  shows on hover and confirms inline — an agent session squash-merges on close, so
 *  the second tap (the ✓) is the deliberate end. */
function SessionRow({ s, active, owner, onSelect, onEnd }: {
  s: SessionInfo; active: boolean; owner: string | null; onSelect: () => void; onEnd: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={`flex h-10 min-w-0 flex-1 items-center gap-3 rounded-ui px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus ${active ? "bg-selected text-ink-100" : "text-subtle hover:bg-hover hover:text-ink-100"}`}
      >
        <Text tone={s.alive ? (s.id === owner ? "accent" : "subtle") : "muted"}>
          <Icon icon={Circle} size={9} fill={s.alive ? "currentColor" : "none"} />
        </Text>
        <span className="min-w-0 flex-1 truncate text-ui">{s.title || s.id}</span>
      </button>
      {confirming ? (
        <Inline gap="xs">
          <button type="button" aria-label="confirm end session" title="End session" onClick={() => { onEnd(); setConfirming(false); }}
            className="grid h-6 w-6 place-items-center rounded-ui text-danger transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus">
            <Icon icon={Check} size={13} />
          </button>
          <button type="button" aria-label="cancel" title="Keep session" onClick={() => setConfirming(false)}
            className="grid h-6 w-6 place-items-center rounded-ui text-muted transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus">
            <Icon icon={X} size={13} />
          </button>
        </Inline>
      ) : (
        <button type="button" aria-label="end session" title="End session" onClick={() => setConfirming(true)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-ui text-muted opacity-0 transition hover:bg-hover hover:text-ink-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus group-hover:opacity-100">
          <Icon icon={X} size={12} />
        </button>
      )}
    </div>
  );
}

export function NavTree() {
  const sessions = useWorkbench((s) => s.sessions);
  const endSession = useWorkbench((s) => s.close);
  const selected = useWorld((s) => s.selected);
  const select = useWorld((s) => s.select);
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });

  const projectState = useQuery({ queryKey: ["zuzuu", "project-state"], queryFn: api.zuzuu.projectState });
  const owner = mostRecentlyActive(sessions.map((s) => ({ id: s.id, live: s.alive, lastActiveAt: s.createdAt })));
  const modules = overview.data?.modules ?? [];
  const showSetup = projectState.data !== undefined && shouldShowSetupNode(projectState.data.state);

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col gap-7 overflow-y-auto border-r border-border bg-surface p-4">
      <NavRow
        active={selected === null || selected.kind === "overview"}
        icon={<Icon icon={Home} size={14} />}
        label="Overview"
        onClick={() => select({ kind: "overview" })}
      />
      {showSetup && (
        <Text as="button" interactive size="meta" tone="accent" weight="semibold" onClick={() => select(null)}>
          <Inline gap="xs"><Icon icon={Flag} size={12} /> Set up this Project</Inline>
        </Text>
      )}

      <Stack gap="xs">
        <Text size="meta" tone="subtle" weight="semibold">SESSIONS</Text>
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            s={s}
            active={selected?.kind === "session" && selected.id === s.id}
            owner={owner}
            onSelect={() => select({ kind: "session", id: s.id })}
            onEnd={() => {
              if (selected?.kind === "session" && selected.id === s.id) select({ kind: "overview" });
              // end resolves after the daemon's squash-merge; surface what it taught.
              void endSession(s.id).then((result) => showCloseCardFromResult(s.id, result));
            }}
          />
        ))}
        {!sessions.length && <Text size="meta" tone="muted">none yet</Text>}
        <NewSessionMenu />
      </Stack>

      <Stack gap="xs">
        <Text size="meta" tone="subtle" weight="semibold">TABLES</Text>
        {modules.map((m) => (
          <NavRow
            key={m.id}
            active={selected?.kind === "module" && selected.id === m.id}
            icon={<Text tone={selected?.kind === "module" && selected.id === m.id ? "accent" : "muted"}>
              <Icon icon={Table2} size={14} />
            </Text>}
            label={m.title}
            badge={m.counts?.pending || undefined}
            onClick={() => select({ kind: "module", id: m.id })}
          />
        ))}
        {!modules.length && <Text size="meta" tone="muted">{overview.isLoading ? "…" : "none yet"}</Text>}
      </Stack>

      <Stack gap="xs">
        <Text size="meta" tone="subtle" weight="semibold">PROJECT</Text>
        <NavRow
          active={selected?.kind === "graph"}
          icon={<Icon icon={Share2} size={14} />}
          label="Graph"
          onClick={() => select({ kind: "graph" })}
        />
        <NavRow
          active={selected?.kind === "search"}
          icon={<Icon icon={Search} size={14} />}
          label="Search"
          onClick={() => select({ kind: "search" })}
        />
        <NavRow
          active={selected?.kind === "settings"}
          icon={<Icon icon={SettingsIcon} size={14} />}
          label="Settings"
          onClick={() => select({ kind: "settings" })}
        />
      </Stack>
    </nav>
  );
}

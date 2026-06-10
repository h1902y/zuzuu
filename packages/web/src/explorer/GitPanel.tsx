import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GitStatusEntry } from "@webcode/protocol";
import { api } from "../lib/api";
import { useEditor } from "../state/editor";

const isStaged = (e: GitStatusEntry) => e.index !== " " && e.index !== "?";
const isUnstaged = (e: GitStatusEntry) => e.worktree !== " " || e.index === "?";

function statusLetter(e: GitStatusEntry, staged: boolean): string {
  const c = staged ? e.index : e.worktree;
  if (e.index === "?" && e.worktree === "?") return "U";
  return c === " " ? "" : c;
}

export function GitPanel() {
  const queryClient = useQueryClient();
  const openFileInEditor = useEditor((s) => s.open);
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["git", "status"],
    queryFn: api.gitStatus,
    refetchInterval: 4000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["git"] });
  };

  if (isLoading) return <Empty>loading…</Empty>;
  if (!data?.repo) return <Empty>not a git repository</Empty>;

  const staged = data.entries.filter(isStaged);
  const changes = data.entries.filter((e) => isUnstaged(e) && !isStaged(e));

  const openDiff = (e: GitStatusEntry) =>
    openFileInEditor({ path: e.path, name: e.path.split("/").pop() ?? e.path, diff: true });

  const commit = async () => {
    if (!message.trim() || staged.length === 0) return;
    try {
      await api.gitCommit(message.trim());
      setMessage("");
      refresh();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-ink-700 px-2 py-1.5 text-[11px] text-ink-300">
        <span className="rounded bg-ink-800 px-1.5 py-0.5 text-accent-dim">⎇ {data.branch}</span>
        <button onClick={refresh} className="ml-auto rounded p-1 hover:bg-ink-700 hover:text-ink-100" title="Refresh">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M13 8a5 5 0 11-1.5-3.5M13 3v2.5h-2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="border-b border-ink-700 p-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Commit message (${staged.length} staged)`}
          rows={2}
          className="w-full resize-none rounded border border-ink-700 bg-ink-950 px-2 py-1 text-[12px] text-ink-100 placeholder:text-ink-500 focus:border-accent-dim focus:outline-none"
        />
        <button
          onClick={() => void commit()}
          disabled={!message.trim() || staged.length === 0}
          className="mt-1.5 w-full rounded border border-ink-700 py-1 text-[12px] text-accent enabled:hover:border-accent-dim disabled:opacity-40"
        >
          Commit
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Section
          title="Staged"
          entries={staged}
          staged
          onClick={openDiff}
          onAction={(e) => void api.gitUnstage([e.path]).then(refresh)}
          actionTitle="Unstage"
          actionIcon="M3 8h10"
        />
        <Section
          title="Changes"
          entries={changes}
          staged={false}
          onClick={openDiff}
          onAction={(e) => void api.gitStage([e.path]).then(refresh)}
          actionTitle="Stage"
          actionIcon="M8 3v10M3 8h10"
        />
        {data.entries.length === 0 && <Empty>no changes</Empty>}
      </div>
    </div>
  );
}

function Section({
  title,
  entries,
  staged,
  onClick,
  onAction,
  actionTitle,
  actionIcon,
}: {
  title: string;
  entries: GitStatusEntry[];
  staged: boolean;
  onClick: (e: GitStatusEntry) => void;
  onAction: (e: GitStatusEntry) => void;
  actionTitle: string;
  actionIcon: string;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="py-1">
      <div className="px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-500">
        {title} · {entries.length}
      </div>
      {entries.map((e) => {
        const letter = statusLetter(e, staged);
        return (
          <div
            key={e.path}
            className="group flex cursor-default items-center gap-1.5 px-2 py-0.5 text-[12px] hover:bg-ink-800"
            onClick={() => onClick(e)}
            title={e.path}
          >
            <span className="truncate text-ink-100">{e.path.split("/").pop()}</span>
            <span className="truncate text-[11px] text-ink-500">{e.path.split("/").slice(0, -1).join("/")}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  onAction(e);
                }}
                title={actionTitle}
                className="hidden rounded p-0.5 text-ink-400 hover:bg-ink-700 hover:text-ink-100 group-hover:block"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d={actionIcon} strokeLinecap="round" />
                </svg>
              </button>
              <span className={`w-3 text-center text-[11px] ${letter === "D" ? "text-danger" : letter === "U" ? "text-accent-dim" : "text-yellow-500"}`}>
                {letter}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-2 text-[12px] text-ink-500">{children}</div>;
}

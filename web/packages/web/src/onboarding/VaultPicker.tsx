import { Overlay, Dialog, DialogHeader, Button, prompt, cx } from "../components/ui";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { breadcrumbs, capRecents, tilde } from "./vault-picker-logic";

// ── Folder icon (16×16 stroke) ────────────────────────────────────────────────
const FOLDER_PATH =
  "M1.5 3.5A1.5 1.5 0 013 2h3l1.5 1.5H13A1.5 1.5 0 0114.5 5v7A1.5 1.5 0 0113 13.5H3A1.5 1.5 0 011.5 12v-8.5z";

const UP_PATH =
  "M8 12V4m0 0L4.5 7.5M8 4l3.5 3.5";

const DRILL_PATH = "M6 4l4 4-4 4";

/**
 * Mini directory browser for picking a workspace (vault). Starts at the
 * current vault (or ~), with a clickable breadcrumb of every ancestor, a
 * ".. (parent)" row, and drill-down rows: clicking a row navigates INTO the
 * directory; the trailing "Open" button (or the footer's primary button for
 * the directory being browsed) switches the vault to it. Recents sit in a
 * small capped section under the browser — restyled as warm cards.
 *
 * Behavior (vault-picker-logic.ts) is unchanged.
 */
export function VaultPicker({
  recent,
  currentRoot,
  onClose,
  onPick,
}: {
  recent: string[];
  currentRoot?: string;
  onClose: () => void;
  onPick: (path: string) => void;
}) {
  const [path, setPath] = useState<string | undefined>(currentRoot);

  const browse = useQuery({
    queryKey: ["browse", path ?? "~"],
    queryFn: () => api.browse(path),
  });
  const here = browse.data?.path;
  const parent = browse.data?.parent ?? null;
  const crumbs = here ? breadcrumbs(here) : [];
  const recents = capRecents(recent, currentRoot, 5);

  const newFolder = async () => {
    if (!here) return;
    const name = await prompt({
      title: "New folder",
      placeholder: "created here, then opened",
      okLabel: "Create",
    });
    if (!name) return;
    try {
      const res = await api.browseMkdir(here, name);
      onPick(res.path);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <Dialog width="lg" className="flex h-[60vh] flex-col !max-w-xl">
        <DialogHeader title="Open a folder as workspace" onClose={onClose} />

        {/* ── Recents as warm cards — shown at top when available ─────────── */}
        {recents.length > 0 && (
          <div className="border-b border-border px-3 pt-3 pb-2">
            <div className="wc-eyebrow mb-2">Recent</div>
            <div className="flex flex-wrap gap-1.5">
              {recents.map((r) => (
                <button
                  key={r}
                  onClick={() => onPick(r)}
                  title={r}
                  className={cx(
                    "wc-focus wc-mono flex max-w-xs items-center gap-1.5 truncate",
                    "rounded-[var(--radius-ui)] border border-border bg-surface px-2.5 py-1.5",
                    "text-meta text-ink-300 transition-colors",
                    "hover:border-accent-dim hover:bg-elevated hover:text-ink-100",
                  )}
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3 w-3 shrink-0 text-accent-dim"
                    fill="currentColor"
                  >
                    <path d={FOLDER_PATH} />
                  </svg>
                  {tilde(r)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-y-0.5 border-b border-border px-3 py-1.5 text-ui">
          {crumbs.length === 0 && <span className="wc-mono text-ink-500">…</span>}
          {crumbs.map((c, i) => (
            <span key={c.path} className="flex max-w-full items-center">
              {i > 0 && <span className="px-0.5 text-ink-600">/</span>}
              {c.path === here ? (
                <span className="wc-mono truncate rounded px-0.5 text-ink-100" title={c.path}>
                  {c.label}
                </span>
              ) : (
                <button
                  onClick={() => setPath(c.path)}
                  className="wc-focus wc-mono truncate rounded px-0.5 text-ink-400 hover:bg-hover hover:text-ink-100"
                  title={c.path}
                >
                  {c.label}
                </button>
              )}
            </span>
          ))}
        </div>

        {/* ── Directory browser ──────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-auto py-1">
          {browse.isLoading && (
            <div className="wc-sans px-3 py-2 text-ui text-ink-500">loading…</div>
          )}
          {browse.error && (
            <div className="wc-sans px-3 py-2 text-ui text-danger">
              {(browse.error as Error).message}
            </div>
          )}
          {parent && (
            <div
              className="flex cursor-default items-center gap-2 px-3 py-1 text-ui text-ink-400 hover:bg-hover hover:text-ink-100"
              onClick={() => setPath(parent)}
              title={parent}
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d={UP_PATH} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="wc-sans">.. (parent)</span>
            </div>
          )}
          {browse.data?.dirs.length === 0 && (
            <div className="wc-sans px-3 py-2 text-ui text-ink-500">no subfolders</div>
          )}
          {browse.data?.dirs.map((d) => (
            <div
              key={d.path}
              className="group flex cursor-default items-center gap-2 px-3 py-1 text-ui hover:bg-hover"
              onClick={() => setPath(d.path)}
              onDoubleClick={() => onPick(d.path)}
              title={`Click to browse into ${d.name}`}
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 shrink-0 text-accent-dim"
                fill="currentColor"
              >
                <path d={FOLDER_PATH} />
              </svg>
              <span className="wc-sans truncate text-ink-100">{d.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(d.path);
                }}
                title={`Open ${d.name} as workspace`}
                className={cx(
                  "wc-focus wc-sans ml-auto hidden shrink-0",
                  "rounded-[var(--radius-sm)] border border-border px-2 py-0.5",
                  "text-meta text-accent group-hover:block hover:bg-hover",
                )}
              >
                Open
              </button>
              {/* drill-in hint, swapped for the Open button on hover */}
              <svg
                viewBox="0 0 16 16"
                className="ml-auto h-3 w-3 shrink-0 text-ink-600 group-hover:hidden"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d={DRILL_PATH} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
        </div>

        {/* ── Footer — primary CTA + new-folder secondary ───────────────── */}
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <Button variant="ghost" onClick={() => void newFolder()}>
            New folder…
          </Button>
          <Button
            variant="primary"
            className="ml-auto"
            onClick={() => here && onPick(here)}
            disabled={!here}
          >
            Open this folder
          </Button>
        </div>
      </Dialog>
    </Overlay>
  );
}

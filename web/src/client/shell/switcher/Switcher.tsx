// shell/switcher/Switcher.tsx — the project switcher (R9–R12). The home title
// ⌂ <project> is the trigger; ⌘O toggles it. Picking a recent (or an absolute
// path via the open-folder autocomplete) switches IN PLACE (D1: POST /api/workspace/
// switch, which tears down the current sessions and re-roots) — then a reload
// re-fetches everything against the new root. Composes from ds primitives + the kit;
// the popover frame uses static layout utilities only (no inline styles / arbitrary values).
import { useEffect, useReducer, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { Database, ChevronDown, CornerDownRight } from "lucide-react";
import { pickerRows, openFolderReducer, initialOpenFolder } from "../switcher-model.js";
import { toast } from "../../state/toast.js";
import { Stack, Inline, Text, Icon } from "../../ds/index.js";

export function Switcher() {
  const [open, setOpen] = useState(false);
  const [folder, dispatch] = useReducer(openFolderReducer, initialOpenFolder);
  const workspace = useQuery({ queryKey: ["workspace"], queryFn: api.workspace });
  const recents = useQuery({ queryKey: ["projects", "recents"], queryFn: api.projects.recents, enabled: open });

  // ⌘O / Ctrl-O toggles the switcher; Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live directory autocomplete — only for absolute paths (keeps the built path absolute).
  useEffect(() => {
    if (!open || !folder.prefix.startsWith("/")) return;
    let alive = true;
    void api.projects.dir(folder.prefix).then((d) => { if (alive) dispatch({ type: "setDirs", dirs: d.dirs }); });
    return () => { alive = false; };
  }, [open, folder.prefix]);

  async function switchTo(path: string) {
    try { await api.switchWorkspace(path); window.location.reload(); } // in-place re-root → reload re-fetches all
    catch { toast(`Couldn't open ${path}`, "error"); } // stay put on an invalid path
  }

  const rows = pickerRows(recents.data?.recents ?? []);
  const name = workspace.data?.name ?? "…";

  return (
    <div className="relative">
      <Text as="button" interactive size="meta" tone="muted" weight="semibold" onClick={() => setOpen((v) => !v)}>
        <Inline gap="xs"><Icon icon={Database} size={13} /> {name} <Icon icon={ChevronDown} size={12} /></Inline>
      </Text>
      {open && (
        <>
          <button type="button" aria-label="close" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="animate-pop absolute left-0 top-full z-20 mt-1 w-72 rounded-ui border border-border bg-elevated p-2 shadow-overlay">
            <Stack gap="xs">
              <Text size="meta" tone="subtle" weight="semibold">SWITCH PROJECT</Text>
              {rows.map((row) => (
                <button
                  key={row.path}
                  type="button"
                  disabled={row.current}
                  onClick={() => switchTo(row.path)}
                  className="flex w-full items-center justify-between gap-2 rounded-ui px-2 py-1 text-left text-ui text-subtle transition-colors hover:bg-hover hover:text-ink-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus disabled:cursor-default disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  {row.current && <Text size="meta" tone="muted">current</Text>}
                </button>
              ))}
              {!rows.length && <Text size="meta" tone="muted">no recent projects</Text>}

              <div className="mt-1 border-t border-border pt-2">
                <Text size="meta" tone="subtle" weight="semibold">OPEN A FOLDER…</Text>
                <input
                  value={folder.prefix}
                  onChange={(e) => dispatch({ type: "setPrefix", prefix: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); dispatch({ type: "moveHighlight", delta: 1 }); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); dispatch({ type: "moveHighlight", delta: -1 }); }
                    else if (e.key === "Enter") {
                      if (folder.dirs.length) { e.preventDefault(); dispatch({ type: "applyHighlighted" }); }
                      else if (folder.prefix.startsWith("/")) void switchTo(folder.prefix);
                    }
                  }}
                  placeholder="/absolute/path/to/folder"
                  className="mt-1 w-full rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
                />
                {folder.dirs.length > 0 && (
                  <Stack gap="none">
                    {folder.dirs.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => dispatch({ type: "applyAt", index: i })}
                        className={`flex items-center rounded-ui px-2 py-1 text-left text-meta transition-colors hover:bg-hover ${i === folder.highlighted ? "bg-selected text-ink-100" : "text-subtle"}`}
                      >
                        <Inline gap="xs"><Icon icon={CornerDownRight} size={11} /> {d}/</Inline>
                      </button>
                    ))}
                  </Stack>
                )}
              </div>
            </Stack>
          </div>
        </>
      )}
    </div>
  );
}

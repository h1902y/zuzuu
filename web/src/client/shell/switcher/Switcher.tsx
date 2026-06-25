// shell/switcher/Switcher.tsx — the in-context fast-switch (the Projects Home is the
// manage surface; this is the keyboard-fast jump). The home title ⌂ <project> is the
// trigger; ⌘O toggles it. The popover carries: "← All projects" (back to the L1
// launcher), a live-search recents list (current marked), and the "Open a folder…"
// autocomplete. Picking a recent or a path switches IN PLACE via enterProject
// (POST /api/workspace/switch → land on the Overview, NO page reload — app state is
// preserved). Composes from ds primitives + the kit; static layout utilities only.
import { useEffect, useReducer, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { Database, ChevronDown, CornerDownRight, ArrowLeft } from "lucide-react";
import { pickerRows, filterPickerRows, openFolderReducer, initialOpenFolder } from "../switcher-model.js";
import { useEnterProject } from "../session/use-enter-project.js";
import { useAppSurface } from "../../state/app-surface.js";
import { Stack, Inline, Text, Icon } from "../../ds/index.js";

export function Switcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [folder, dispatch] = useReducer(openFolderReducer, initialOpenFolder);
  const workspace = useQuery({ queryKey: ["workspace"], queryFn: api.workspace });
  const recents = useQuery({ queryKey: ["projects", "recents"], queryFn: api.projects.recents, enabled: open });
  const enter = useEnterProject();
  const setScreen = useAppSurface((s) => s.setScreen);

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

  const switchTo = (path: string) => { setOpen(false); void enter(path); }; // in-place re-root, no reload
  const toHome = () => { setOpen(false); setScreen("projects"); };

  const rows = filterPickerRows(pickerRows(recents.data?.recents ?? []), query);
  const name = workspace.data?.name ?? "…";

  return (
    <div className="relative">
      <Text as="button" interactive size="meta" tone="muted" weight="semibold" onClick={() => setOpen((v) => !v)}>
        <Inline gap="xs"><Icon icon={Database} size={13} /> {name} <Icon icon={ChevronDown} size={12} /></Inline>
      </Text>
      {open && (
        <>
          <button type="button" aria-label="close" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="animate-pop absolute left-0 top-full z-20 mt-1 w-80 rounded-ui border border-border bg-elevated p-2 shadow-overlay">
            <Stack gap="xs">
              <button
                type="button"
                onClick={toHome}
                className="flex w-full items-center gap-2 rounded-ui px-2 py-1 text-left text-meta text-subtle transition-colors hover:bg-hover hover:text-ink-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
              >
                <Icon icon={ArrowLeft} size={13} /> All projects
              </button>

              <div className="border-t border-border pt-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects…"
                  className="w-full rounded-ui bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:bg-surface"
                />
              </div>

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
              {!rows.length && <Text size="meta" tone="muted">no matching projects</Text>}

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
                      else if (folder.prefix.startsWith("/")) switchTo(folder.prefix);
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

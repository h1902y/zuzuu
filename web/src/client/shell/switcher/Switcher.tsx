// shell/switcher/Switcher.tsx — the project picker, lives in the project page header.
// The trigger IS the page title (the project name) + a dropdown; ⌘O toggles it. The
// popover carries: "← All projects" (back to the L1 launcher), a live-search recents
// list (current marked), and "Open a folder…" — the OS-native picker (same Finder
// dialog as the Projects Home "New project"), with a manual-path fallback. Picking a
// recent or a folder switches IN PLACE via enterProject (no page reload). Composes ds
// primitives + the kit; static layout utilities only.
import { useEffect, useReducer, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { ChevronDown, CornerDownRight, ArrowLeft, FolderOpen } from "lucide-react";
import { pickerRows, filterPickerRows, openFolderReducer, initialOpenFolder } from "../switcher-model.js";
import { useEnterProject } from "../session/use-enter-project.js";
import { useAppSurface } from "../../state/app-surface.js";
import { toast } from "../../state/toast.js";
import { Stack, Inline, Text, Icon, Button, EmojiPicker } from "../../ds/index.js";

export function Switcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [folder, dispatch] = useReducer(openFolderReducer, initialOpenFolder);
  const [picking, setPicking] = useState(false);
  const [manual, setManual] = useState(false);
  const workspace = useQuery({ queryKey: ["workspace"], queryFn: api.workspace });
  const recents = useQuery({ queryKey: ["projects", "recents"], queryFn: api.projects.recents, enabled: open });
  const enter = useEnterProject();
  const goHome = useAppSurface((s) => s.home);
  const qc = useQueryClient();

  async function onSetEmoji(emoji: string) {
    const root = workspace.data?.root;
    if (!root) return;
    try {
      await api.projects.setEmoji(root, emoji);
      void qc.invalidateQueries({ queryKey: ["workspace"] });
      void qc.invalidateQueries({ queryKey: ["projects", "list"] });
    } catch { toast("Couldn't set the emoji", "error"); }
  }

  // ⌘O / Ctrl-O toggles the picker; Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Manual fallback only: live directory autocomplete for absolute paths.
  useEffect(() => {
    if (!open || !manual || !folder.prefix.startsWith("/")) return;
    let alive = true;
    void api.projects.dir(folder.prefix).then((d) => { if (alive) dispatch({ type: "setDirs", dirs: d.dirs }); });
    return () => { alive = false; };
  }, [open, manual, folder.prefix]);

  const switchTo = (path: string) => { setOpen(false); void enter(path); }; // in-place re-root, no reload
  const toHome = () => { setOpen(false); goHome(); };

  // The OS-native folder picker (the same experience as the Projects Home "New project").
  async function nativePick() {
    setPicking(true);
    try {
      const r = await api.projects.pick();
      if (r.path) { switchTo(r.path); return; }
      if (r.unsupported) { setManual(true); toast("Native picker unavailable — enter a path", "default"); return; }
      if (r.error) { toast(r.error, "error"); setManual(true); }
      // cancelled → no-op
    } catch { setManual(true); }
    finally { setPicking(false); }
  }

  const rows = filterPickerRows(pickerRows(recents.data?.recents ?? []), query);
  const name = workspace.data?.name ?? "…";

  return (
    <div className="flex items-center gap-1">
      <EmojiPicker
        value={workspace.data?.emoji ?? "📦"}
        onPick={(e) => void onSetEmoji(e)}
        label="Change project emoji"
      />
      <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-1.5 rounded-ui px-2 py-1 transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
      >
        <Text size="lg" font="display">{name}</Text>
        <Icon icon={ChevronDown} size={14} />
      </button>
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
                <Stack gap="sm">
                  <Button variant="outline" size="sm" disabled={picking} onClick={() => void nativePick()}>
                    <Icon icon={FolderOpen} size={14} /> {picking ? "Choosing…" : "Choose a folder…"}
                  </Button>

                  {!manual ? (
                    <Text as="button" interactive size="meta" tone="muted" onClick={() => setManual(true)}>
                      or enter a path manually
                    </Text>
                  ) : (
                    <Stack gap="none">
                      <input
                        autoFocus
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
                        className="w-full rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
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
                    </Stack>
                  )}
                </Stack>
              </div>
            </Stack>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

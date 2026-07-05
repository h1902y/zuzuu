// shell/projects/NewProject.tsx — "New / Open a folder" for the Projects Home.
// Primary path: the OS-native folder picker (the local daemon pops the real Finder
// dialog → an absolute path → opens it). Fallback: a manual path field with the
// names-only autocomplete (also the path for non-mac / hosted). Opening hands off to
// useEnterProject (switchTo → Overview). A modal composing the shared ds/kit/Dialog
// (U3, curried-plotting-coral.md) — Escape (when topmost) + outside-click dismiss come
// from Dialog's useDismiss wiring instead of a private keydown listener. Thin .tsx;
// static layout utilities only.
import { useEffect, useReducer, useState } from "react";
import { CornerDownRight, FolderOpen } from "lucide-react";
import { api } from "../../lib/api.js";
import { openFolderReducer, initialOpenFolder } from "../switcher-model.js";
import { useEnterProject } from "../session/use-enter-project.js";
import { toast } from "../../state/toast.js";
import { Stack, Inline, Text, Icon, Button, Dialog } from "../../ds/index.js";

export function NewProject({ onClose }: { onClose: () => void }) {
  const [folder, dispatch] = useReducer(openFolderReducer, initialOpenFolder);
  const [picking, setPicking] = useState(false);
  const [manual, setManual] = useState(false);
  const enter = useEnterProject();

  // Live directory autocomplete — absolute paths only (keeps the built path absolute).
  useEffect(() => {
    if (!manual || !folder.prefix.startsWith("/")) return;
    let alive = true;
    void api.projects.dir(folder.prefix).then((d) => { if (alive) dispatch({ type: "setDirs", dirs: d.dirs }); });
    return () => { alive = false; };
  }, [manual, folder.prefix]);

  const open = (path: string) => { onClose(); void enter(path); };

  async function nativePick() {
    setPicking(true);
    try {
      const r = await api.projects.pick();
      if (r.path) { open(r.path); return; }
      if (r.unsupported) { setManual(true); toast("Native picker unavailable — enter a path", "default"); return; }
      if (r.error) { toast(r.error, "error"); setManual(true); }
      // cancelled → no-op
    } catch { setManual(true); }
    finally { setPicking(false); }
  }

  return (
    <Dialog
      open
      id="new-project"
      title={<Inline gap="sm"><Icon icon={FolderOpen} size={20} /><Text size="lg" font="display">Open a folder</Text></Inline>}
      onClose={onClose}
      className="inset-x-6 top-32 mx-auto w-full max-w-xl p-6"
      footer={<Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
    >
      <Stack gap="md">
        <Text size="meta" tone="muted">Point the workbench at any folder. It becomes a Project once you initialize it.</Text>

        <Button variant="primary" size="md" disabled={picking} onClick={() => void nativePick()}>
          <Icon icon={FolderOpen} size={16} /> {picking ? "Choosing…" : "Choose a folder…"}
        </Button>

        {!manual && (
          <Text as="button" interactive size="meta" tone="muted" onClick={() => setManual(true)}>
            or enter a path manually
          </Text>
        )}

        {manual && (
          <Stack gap="sm">
            <input
              autoFocus
              value={folder.prefix}
              onChange={(e) => dispatch({ type: "setPrefix", prefix: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); dispatch({ type: "moveHighlight", delta: 1 }); }
                else if (e.key === "ArrowUp") { e.preventDefault(); dispatch({ type: "moveHighlight", delta: -1 }); }
                else if (e.key === "Enter") {
                  if (folder.dirs.length) { e.preventDefault(); dispatch({ type: "applyHighlighted" }); }
                  else if (folder.prefix.startsWith("/")) open(folder.prefix);
                }
              }}
              placeholder="/absolute/path/to/folder"
              className="w-full rounded-ui border border-border bg-app px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
            />
            {folder.dirs.length > 0 && (
              <Stack gap="none">
                {folder.dirs.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => dispatch({ type: "applyAt", index: i })}
                    className={`flex items-center rounded-ui px-3 py-2 text-left text-ui transition-colors hover:bg-hover ${i === folder.highlighted ? "bg-selected text-ink-100" : "text-subtle"}`}
                  >
                    <Inline gap="xs"><Icon icon={CornerDownRight} size={13} /> {d}/</Inline>
                  </button>
                ))}
              </Stack>
            )}
            <Inline gap="sm" justify="end">
              <Button variant="primary" size="sm" disabled={!folder.prefix.startsWith("/")} onClick={() => open(folder.prefix)}>Open path</Button>
            </Inline>
          </Stack>
        )}
      </Stack>
    </Dialog>
  );
}

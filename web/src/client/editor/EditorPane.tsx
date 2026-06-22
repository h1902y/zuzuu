// src/client/editor/EditorPane.tsx — the Monaco file editor (files mode).
//
// Open a file → read it (/api/fs/download) → edit → save (⌘S or the button,
// /api/fs/write). Lazy-loaded by RightPanel so Monaco + its workers stay out of
// the main bundle. Default export = the lazy boundary.

import { useEffect, useRef, useState } from "react";
import { Editor, type OnMount } from "@monaco-editor/react";
import { api } from "../lib/api.js";
import { PanelHeader } from "../panel/kit.js";
import { ensureTheme, monacoLanguage } from "./monaco-setup.js";

export default function EditorPane({ path, onClose }: { path: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState<string | null>(null); // the on-disk content
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const draft = useRef(""); // the current editor buffer (avoids a render per keystroke)
  const name = path.split("/").pop() ?? path;

  useEffect(() => {
    let live = true;
    setLoaded(null);
    setDirty(false);
    api
      .readFile(path)
      .then((t) => live && (draft.current = t, setLoaded(t)))
      .catch(() => live && (draft.current = "", setLoaded("")));
    return () => { live = false; };
  }, [path]);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await api.writeFile(path, draft.current);
      setLoaded(draft.current);
      setDirty(false);
    } catch { /* surfaced by the disabled state staying off; keep the draft */ }
    finally { setSaving(false); }
  };

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void save());
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={
          <span className="truncate font-mono text-ui text-subtle" title={path}>
            {name}{dirty ? " ●" : ""}
          </span>
        }
        right={
          <>
            <button
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="text-meta text-muted hover:text-subtle disabled:opacity-40"
            >
              {saving ? "saving…" : "save ⌘S"}
            </button>
            <button onClick={onClose} className="text-muted hover:text-subtle" title="close">✕</button>
          </>
        }
      />
      <div className="min-h-0 flex-1">
        {loaded === null ? (
          <div className="grid h-full place-items-center text-meta text-muted">loading…</div>
        ) : (
          <Editor
            theme={ensureTheme()}
            language={monacoLanguage(name)}
            defaultValue={loaded}
            path={path}
            onMount={onMount}
            onChange={(v) => { draft.current = v ?? ""; setDirty((v ?? "") !== loaded); }}
            options={{
              fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false,
              automaticLayout: true, tabSize: 2, renderWhitespace: "selection",
            }}
          />
        )}
      </div>
    </div>
  );
}

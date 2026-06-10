import { lazy, Suspense } from "react";
import { api } from "../lib/api";
import { categorize } from "../preview/filetypes";
import { useEditor, editorTabId, type OpenFile } from "../state/editor";
import { MediaViewer, MarkdownPreview } from "./MediaViewer";

// Lazy boundary: keeps the whole Monaco graph (editor + language workers,
// ~10MB) out of the main bundle until the first file opens.
const MonacoFile = lazy(() => import("./MonacoFile"));
const DiffTab = lazy(() => import("./DiffTab"));

function EditorFallback() {
  return <div className="flex h-full items-center justify-center text-[12px] text-ink-500">loading editor…</div>;
}

const EDITABLE = new Set(["code", "markdown"]);

export function EditorPane() {
  const openFiles = useEditor((s) => s.openFiles);
  const activePath = useEditor((s) => s.activePath);
  const buffers = useEditor((s) => s.buffers);
  const { setActive, close } = useEditor();

  if (openFiles.length === 0) return null;
  const active = openFiles.find((f) => editorTabId(f) === activePath) ?? openFiles[0]!;

  return (
    <div className="flex h-full min-w-0 flex-col bg-ink-900">
      {/* tab bar */}
      <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-ink-700">
        {openFiles.map((f) => {
          const id = editorTabId(f);
          const dirty = buffers[id]?.dirty;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`group flex max-w-48 items-center gap-1.5 border-r border-ink-700 px-3 py-1.5 text-[12px] ${
                id === activePath ? "bg-ink-950 text-ink-100" : "bg-ink-900 text-ink-300 hover:bg-ink-850"
              }`}
              title={f.path}
            >
              {f.diff && <span className="text-[10px] text-accent-dim">diff</span>}
              <span className="truncate">{f.name}</span>
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  close(id);
                }}
                className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded text-ink-500 hover:bg-ink-700 hover:text-ink-100"
              >
                {dirty ? <span className="h-1.5 w-1.5 rounded-full bg-ink-300 group-hover:hidden" /> : null}
                <span className={dirty ? "hidden group-hover:inline" : ""}>×</span>
              </span>
            </button>
          );
        })}
      </div>
      <ActiveBody file={active} />
    </div>
  );
}

function ActiveBody({ file }: { file: OpenFile }) {
  const mdPreview = useEditor((s) => s.mdPreview[editorTabId(file)] ?? false);
  const toggleMdPreview = useEditor((s) => s.toggleMdPreview);
  const save = useEditor((s) => s.save);
  const buffer = useEditor((s) => s.buffers[editorTabId(file)]);

  if (file.diff) {
    return (
      <div className="min-h-0 flex-1">
        <Suspense fallback={<EditorFallback />}>
          <DiffTab path={file.path} name={file.name} />
        </Suspense>
      </div>
    );
  }

  const category = categorize(file.name);
  const isMarkdown = category === "markdown";
  const editable = EDITABLE.has(category);

  return (
    <>
      {(isMarkdown || editable) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-ink-700 px-3 py-1 text-[11px] text-ink-500">
          {isMarkdown && (
            <div className="flex overflow-hidden rounded border border-ink-700">
              <Seg active={!mdPreview} onClick={() => mdPreview && toggleMdPreview(editorTabId(file))}>Edit</Seg>
              <Seg active={mdPreview} onClick={() => !mdPreview && toggleMdPreview(editorTabId(file))}>Preview</Seg>
            </div>
          )}
          <span className="ml-auto truncate">{file.path}</span>
          <button
            onClick={() => void api.openLocal(file.path, true)}
            className="rounded px-1 hover:text-ink-100"
            title="Reveal in Finder"
          >
            reveal
          </button>
          {buffer?.dirty && (
            <button
              onClick={() => void save(editorTabId(file))}
              className="rounded px-1 text-accent hover:text-ink-100"
              title="Save (⌘S)"
            >
              save
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {isMarkdown && mdPreview ? (
          <MarkdownPreview path={file.path} text={buffer?.value ?? ""} />
        ) : editable ? (
          <Suspense fallback={<EditorFallback />}>
            <MonacoFile path={file.path} name={file.name} />
          </Suspense>
        ) : (
          <MediaViewer file={file} />
        )}
      </div>
    </>
  );
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 ${active ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-200"}`}
    >
      {children}
    </button>
  );
}

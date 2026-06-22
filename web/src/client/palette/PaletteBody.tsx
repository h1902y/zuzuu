// src/client/palette/PaletteBody.tsx — the cmdk command-palette body (lazy).
//
// Fuzzy file-open + a few commands. Filtering uses our own fuzzyScore (so the
// ranking is the tested one); cmdk owns the keyboard + selection. Lazy-loaded by
// Palette on first ⌘P/⌘K so cmdk stays out of the main bundle. Only mounts while
// open, so the file list loads on mount.

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { usePanel } from "../state/panel.js";
import { useWorkbench } from "../state/store.js";
import { api } from "../lib/api.js";
import { fuzzyScore } from "./palette-logic.js";

export default function PaletteBody() {
  const setPalette = usePanel((s) => s.setPalette);
  const openFile = usePanel((s) => s.openFile);
  const showModules = usePanel((s) => s.showModules);
  const openSession = useWorkbench((s) => s.open);
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    api.listFiles().then((r) => setFiles(r.files)).catch(() => {});
  }, []);

  const close = () => setPalette(false);

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 pt-[12vh]" onClick={close}>
      <Command
        label="Command palette"
        filter={(value, search) => {
          const s = fuzzyScore(search, value);
          return s === null ? 0 : 1 / (1 + s);
        }}
        className="h-fit w-[560px] max-w-[90vw] overflow-hidden rounded-ui border border-border bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          placeholder="files & commands…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-body text-ink-100 outline-none placeholder:text-muted"
        />
        <Command.List className="max-h-[50vh] overflow-y-auto p-1">
          <Command.Empty className="px-3 py-4 text-meta text-muted">no matches</Command.Empty>
          <Command.Group heading="Commands" className="px-2 py-1 text-meta text-muted">
            <Item value="new shell" onSelect={() => { void openSession("shell"); close(); }}>New shell</Item>
            <Item value="show modules" onSelect={() => { showModules(); close(); }}>Show modules</Item>
          </Command.Group>
          <Command.Group heading="Files" className="px-2 py-1 text-meta text-muted">
            {files.map((f) => (
              <Item key={f} value={f} onSelect={() => { openFile(f); close(); }}>{f}</Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

function Item({ value, onSelect, children }: { value: string; onSelect: () => void; children: React.ReactNode }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="cursor-pointer truncate rounded px-3 py-1.5 font-mono text-ui text-subtle data-[selected=true]:bg-hover data-[selected=true]:text-ink-100"
    >
      {children}
    </Command.Item>
  );
}

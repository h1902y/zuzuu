// src/client/editor/monaco-setup.ts — offline Monaco wiring.
//
// Monaco's language workers are bundled locally via Vite `?worker` imports (no
// CDN — the daemon serves the workbench offline), the dark theme matches our ink
// ramp, and a small extension→language map drives syntax highlighting.

import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker(_id, label) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco }); // use the bundled monaco, not @monaco-editor/react's CDN default

const THEME = "zuzuu-dark";
let defined = false;

/** Register the ink/accent dark theme once; returns its name. */
export function ensureTheme(): string {
  if (!defined) {
    monaco.editor.defineTheme(THEME, {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0a0d12",
        "editor.foreground": "#d6dde8",
        "editorLineNumber.foreground": "#4a5568",
        "editor.selectionBackground": "#2c4f6e80",
        "editorCursor.foreground": "#58e6c0",
        "editor.lineHighlightBackground": "#11161f",
        "editorWidget.background": "#11161f",
        "diffEditor.insertedTextBackground": "#57ab5a22",
        "diffEditor.removedTextBackground": "#f4706722",
      },
    });
    defined = true;
  }
  return THEME;
}

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", json: "json", jsonc: "json",
  md: "markdown", markdown: "markdown", css: "css", scss: "scss", less: "less",
  html: "html", htm: "html", xml: "xml", svg: "xml", yml: "yaml", yaml: "yaml",
  toml: "ini", ini: "ini", sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
  py: "python", rb: "ruby", rs: "rust", go: "go", java: "java", c: "c", h: "c",
  cpp: "cpp", hpp: "cpp", cs: "csharp", php: "php", sql: "sql", lua: "lua",
};

/** Map a filename to a Monaco language id. */
export function monacoLanguage(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  return EXT_LANG[ext] ?? "plaintext";
}

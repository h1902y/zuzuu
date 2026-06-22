// src/client/lib/warm.ts — preload the lazy editor/cast chunks during the
// hover→click gap, so the right-panel pane opens instantly instead of paying the
// Monaco fetch on click. These dynamic imports dedupe with RightPanel's lazy()
// boundaries (same chunk), so warming is free once and idempotent after.

export function warmFile(path: string): void {
  if (path.endsWith(".cast")) void import("../preview/CastView.js");
  else void import("../editor/EditorPane.js");
}

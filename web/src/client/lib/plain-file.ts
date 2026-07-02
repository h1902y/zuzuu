// lib/plain-file.ts — §G.3: "the plain-file link." Every note/module the workbench
// renders is JUST a file on disk; this derives its path, root-mode aware (mirrors
// the daemon's `resolveHome`: root-mode → modules live at the repo root, no prefix;
// classic → under `.zuzuu/`). Pure text — never a file-opener (the browser can't
// reach the local filesystem); every caller's affordance is "show the path + copy."

const prefixed = (rel: string, rootMode: boolean): string => (rootMode ? rel : `.zuzuu/${rel}`);

/** A note's on-disk path: `<module>/items/<id>.md` (root-mode) or
 *  `.zuzuu/<module>/items/<id>.md` (classic) — the envelope's home, one file per row. */
export function notePath(module: string, id: string, rootMode: boolean): string {
  return prefixed(`${module}/items/${id}.md`, rootMode);
}

/** A module's contract file: `<module>/module.md` (root-mode) or
 *  `.zuzuu/<module>/module.md` (classic) — the table's schema, plain text. */
export function modulePath(module: string, rootMode: boolean): string {
  return prefixed(`${module}/module.md`, rootMode);
}

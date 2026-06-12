// Pure logic for the vault picker dialog + the status-bar vault menu
// (breadcrumb segmentation, parent resolution, recents capping, subdir
// extraction). No DOM — unit-tested in vault-picker-logic.test.ts.

export interface Crumb {
  /** display label ("~", "/", or the segment name) */
  label: string;
  /** absolute path this crumb navigates to */
  path: string;
}

/** Collapse the macOS/Linux home prefix for display. */
export const tilde = (p: string) => p.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");

/**
 * Split an absolute path into clickable breadcrumb segments, root first.
 * The home directory (/Users/x or /home/x) collapses to a single "~" crumb;
 * paths outside a home dir start at "/".
 */
export function breadcrumbs(absPath: string): Crumb[] {
  if (!absPath.startsWith("/")) return [];
  const home = /^(\/Users\/[^/]+|\/home\/[^/]+)(?:\/|$)/.exec(absPath)?.[1];
  const crumbs: Crumb[] = home ? [{ label: "~", path: home }] : [{ label: "/", path: "/" }];
  const rest = home ? absPath.slice(home.length) : absPath;
  for (const seg of rest.split("/").filter(Boolean)) {
    const prev = crumbs[crumbs.length - 1]!.path;
    crumbs.push({ label: seg, path: prev === "/" ? `/${seg}` : `${prev}/${seg}` });
  }
  return crumbs;
}

/** Parent of an absolute directory, or null at (or above) the fs root. */
export function parentDir(absPath: string): string | null {
  if (!absPath.startsWith("/")) return null;
  const trimmed = absPath.replace(/\/+$/, "");
  if (trimmed === "") return null; // was "/"
  const parent = trimmed.split("/").slice(0, -1).join("/");
  return parent === "" ? "/" : parent;
}

/** Recents for menus/pickers: drop the current root + duplicates, cap at `max`. */
export function capRecents(recent: string[], currentRoot: string | undefined, max = 5): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of recent) {
    if (!r || r === currentRoot || seen.has(r)) continue;
    seen.add(r);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** Directory entry names from an fs listing (symlinked dirs count), capped. */
export function menuSubdirs(
  entries: { name: string; kind: string; targetKind?: string }[],
  max = 8,
): string[] {
  const dirs = entries
    .filter((e) => e.kind === "dir" || e.targetKind === "dir")
    .map((e) => e.name);
  // visible dirs first — dot-dirs are rarely switch targets and crowd the menu
  return [...dirs.filter((n) => !n.startsWith(".")), ...dirs.filter((n) => n.startsWith("."))].slice(0, max);
}

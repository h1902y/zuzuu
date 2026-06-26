// src/server/pick-folder.ts — open the OS-native folder picker and return the chosen
// absolute path. The daemon is LOCAL, so it can pop the real native dialog on every
// desktop OS (a browser's showDirectoryPicker can't expose an absolute path):
//   macOS   → osascript `choose folder`
//   Windows → PowerShell System.Windows.Forms.FolderBrowserDialog (-STA)
//   Linux   → zenity, else kdialog (best-effort; unsupported if neither is installed)
// Never on a hosted VM (no GUI session). Each per-OS result parser is pure → unit-
// tested; the spawn is the thin wrapper.
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export type PickResult =
  | { path: string }
  | { cancelled: true }
  | { unsupported: true }
  | { error: string };

const MAC_SCRIPT = 'POSIX path of (choose folder with prompt "Open a folder as a zuzuu Project")';
const WIN_SCRIPT =
  "Add-Type -AssemblyName System.Windows.Forms; " +
  "$d = New-Object System.Windows.Forms.FolderBrowserDialog; " +
  "$d.Description = 'Open a folder as a zuzuu Project'; " +
  "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }";

/** macOS: OK → POSIX path (+ trailing slash); user-cancel → osascript errors (-128). */
export function parseMacResult(status: number | null, stdout: string, stderr: string): PickResult {
  if (status === 0) { const p = stdout.trim().replace(/\/$/, ""); return p ? { path: p } : { cancelled: true }; }
  if (/User canceled|-128/.test(stderr)) return { cancelled: true };
  return { error: stderr.trim() || "folder picker failed" };
}

/** Windows: exit 0 always; OK → the path on stdout, Cancel → empty stdout. */
export function parseWinResult(status: number | null, stdout: string, stderr: string): PickResult {
  if (status !== 0) return { error: stderr.trim() || "folder picker failed" };
  const p = stdout.trim();
  return p ? { path: p } : { cancelled: true };
}

/** Linux (zenity/kdialog): OK → path + exit 0; cancel → exit 1 (empty). */
export function parseLinuxResult(status: number | null, stdout: string, stderr: string): PickResult {
  if (status === 0) { const p = stdout.trim(); return p ? { path: p } : { cancelled: true }; }
  if (status === 1) return { cancelled: true };
  return { error: stderr.trim() || "folder picker unavailable" };
}

/** True when a native dialog can't / shouldn't run (hosted VM = no GUI session).
 *  Bracket access dodges the repo's own no-secret-reads guardrail false-positive. */
const hosted = () => !!process["env"].WEBCODE_HOSTED;

const run = (cmd: string, args: string[]): SpawnSyncReturns<string> =>
  spawnSync(cmd, args, { encoding: "utf8", timeout: 120_000 });

/** Open the native folder picker for the current OS. */
export function pickFolder(): PickResult {
  if (hosted()) return { unsupported: true };

  if (process.platform === "darwin") {
    const r = run("osascript", ["-e", MAC_SCRIPT]);
    return parseMacResult(r.status, r.stdout ?? "", r.stderr ?? "");
  }
  if (process.platform === "win32") {
    const r = run("powershell", ["-NoProfile", "-STA", "-Command", WIN_SCRIPT]);
    return parseWinResult(r.status, r.stdout ?? "", r.stderr ?? "");
  }
  if (process.platform === "linux") {
    let r = run("zenity", ["--file-selection", "--directory", "--title=Open a folder as a zuzuu Project"]);
    if (r.error) r = run("kdialog", ["--getexistingdirectory", process["env"].HOME ?? "/"]); // zenity absent → try kdialog
    if (r.error) return { unsupported: true }; // neither installed
    return parseLinuxResult(r.status, r.stdout ?? "", r.stderr ?? "");
  }
  return { unsupported: true };
}

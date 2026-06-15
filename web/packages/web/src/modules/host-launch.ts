// Pure mapping from the daemon's detected-hosts response to the session
// composer's host rows, and from a row to the direct-spawn argv
// (POST /api/sessions {type:'agent',...}). Kept React-free so the
// detected/disabled rules and the host→command mapping are unit-testable.

/** Argv an agent session spawns directly on the PTY (no shell, no injection). */
export interface AgentSpawnSpec {
  command: string;
  args: string[];
  /** host CLI name stored on the session (tab title, bookkeeping) */
  host: string;
}

export interface HostRow {
  /** row label */
  label: string;
  /** display command string; key into hostSpawnSpec() */
  command: string;
  /** undetected rows render greyed with "not installed" */
  detected: boolean;
}

// `acceptsArgvPrompt`: the host launches its INTERACTIVE TUI already working on
// a positional prompt argument (`claude "task"` / `codex "task"` — officially
// documented). For those we hand the task as argv: rock-solid, no injection, no
// readiness timing. Hosts without that (Gemini/pi/OpenCode-TUI — their `run`
// subcommands are non-interactive and exit) fall back to keystroke injection
// once the PTY is ready. See resolveStart().
/** Hosts zuzuu can wrap, in menu order; `name` matches zuzuuApi.hosts() entries. */
const KNOWN_HOSTS = [
  { name: "claude-code", label: "Claude Code", command: "claude", acceptsArgvPrompt: true, spawn: { command: "claude", args: [], host: "claude" } },
  { name: "gemini-cli", label: "Gemini CLI", command: "gemini", acceptsArgvPrompt: false, spawn: { command: "gemini", args: [], host: "gemini" } },
  { name: "codex", label: "Codex", command: "codex", acceptsArgvPrompt: true, spawn: { command: "codex", args: [], host: "codex" } },
  { name: "pi", label: "pi", command: "pi", acceptsArgvPrompt: false, spawn: { command: "pi", args: [], host: "pi" } },
] as const;

/** OpenCode ships bundled inside the zuzuu CLI — spawned as `zuzuu code`. Its
 *  TUI takes no positional task (`opencode run` is non-interactive), so it uses
 *  the injection path. */
const OPENCODE = {
  label: "OpenCode (bundled)",
  command: "zuzuu code",
  acceptsArgvPrompt: false,
  spawn: { command: "zuzuu", args: ["code"], host: "opencode" },
} as const;

/** Known hosts marked by detection, plus OpenCode — always launchable (bundled). */
export function buildHostRows(hosts: { name: string }[]): HostRow[] {
  const detected = new Set(hosts.map((h) => h.name));
  return [
    ...KNOWN_HOSTS.map((h) => ({ label: h.label, command: h.command, detected: detected.has(h.name) })),
    { label: OPENCODE.label, command: OPENCODE.command, detected: true },
  ];
}

/** The composer's Enter target: the FIRST detected row in menu order
 *  (OpenCode is always detected — bundled — so a default always exists). */
export function composerDefaultHost(rows: HostRow[]): HostRow | null {
  return rows.find((r) => r.detected) ?? null;
}

/** Row command → direct-spawn argv (opencode → `zuzuu code`); null for unknown. */
export function hostSpawnSpec(rowCommand: string): AgentSpawnSpec | null {
  if (rowCommand === OPENCODE.command) return { ...OPENCODE.spawn, args: [...OPENCODE.spawn.args] };
  const known = KNOWN_HOSTS.find((h) => h.command === rowCommand);
  return known ? { ...known.spawn, args: [...known.spawn.args] } : null;
}

/** Whether a host launches its interactive TUI with a positional prompt arg. */
export function hostAcceptsArgvPrompt(rowCommand: string): boolean {
  if (rowCommand === OPENCODE.command) return OPENCODE.acceptsArgvPrompt;
  return KNOWN_HOSTS.find((h) => h.command === rowCommand)?.acceptsArgvPrompt ?? false;
}

/** How to start a host with an optional first task — the argv-first hybrid:
 *  - hosts that take a positional prompt get the task appended to argv (the
 *    agent boots already working on it — no injection, no readiness timing);
 *  - everyone else gets `injectPrompt` (keystroke injection once the PTY is
 *    ready). A task that starts with `-` could be misparsed as a flag, so it
 *    always takes the injection path even on argv-capable hosts.
 *  Blank task → neither (host opens idle). Null for an unknown row. */
export interface HostStart {
  spec: AgentSpawnSpec;
  injectPrompt?: string;
}
export function resolveStart(rowCommand: string, prompt?: string): HostStart | null {
  const base = hostSpawnSpec(rowCommand);
  if (!base) return null;
  const task = prompt?.trim();
  if (!task) return { spec: base };
  if (hostAcceptsArgvPrompt(rowCommand) && !task.startsWith("-")) {
    return { spec: { ...base, args: [...base.args, task] } };
  }
  return { spec: base, injectPrompt: task };
}

const HOST_TITLES: Record<string, string> = {
  claude: "Claude Code",
  gemini: "Gemini CLI",
  codex: "Codex",
  pi: "pi",
  opencode: "OpenCode",
};

/** Agent tab title: the host's display name (falls back to the raw host id). */
export function agentTabTitle(host: string | undefined): string {
  return (host !== undefined ? HOST_TITLES[host] : undefined) ?? host ?? "agent";
}

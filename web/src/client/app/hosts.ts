// src/client/app/hosts.ts — the host coding-agent CLIs an agent session can run.
// Ids MUST match the daemon's command allowlist (server/server.ts
// DEFAULT_COMMAND_ALLOWLIST). Shared by the session-tab + picker and the composer
// host pill.

export const HOSTS: { id: string; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "gemini", label: "Gemini CLI" },
  { id: "opencode", label: "OpenCode" },
  { id: "pi", label: "pi" },
];

// src/client/composer/host-input.ts — per-host input profile.
//
// The composer is a remote keyboard into each host's interactive TUI, and hosts
// differ in how they accept a turn: the quiescence window before they're "ready"
// for the next message, the submit key, and whether multi-line prose must ride in
// as a bracketed paste. This is the one place that knowledge lives.
//
// Keyed on `SessionInfo.host` — the SAME id set as `app/hosts.ts` HOSTS[].id and
// the daemon's command allowlist (claude · codex · gemini · opencode · pi). An
// unknown/absent host falls back to the default profile.
//
// real-wire-data rule: only Claude Code is verified against the real CLI so far.
// The other hosts run the default profile until checked against their own CLI —
// flip `verified` and tune the fields when you do. Adding a verified host = one
// entry here; no other file changes.

export interface HostInputProfile {
  /** quiescence window (ms) of no PTY output before the agent is treated as ready */
  quietMs: number;
  /** the submit key, sent as a separate delayed write after the message body */
  submit: string;
  /** wrap a multi-line body in a bracketed-paste block (inner newlines = content,
   *  not per-line submits) — every TUI we target supports DECSET 2004 */
  multilinePaste: boolean;
  /** has this profile been checked against the real host CLI? (honesty marker) */
  verified: boolean;
}

export const DEFAULT_PROFILE: HostInputProfile = {
  quietMs: 600,
  submit: "\r",
  multilinePaste: true,
  verified: false,
};

// Per-host overrides, merged over DEFAULT_PROFILE. Keep minimal + honest — only add
// a field when a real-CLI check shows the host differs from the default.
const PROFILES: Record<string, Partial<HostInputProfile>> = {
  // Claude Code: bracketed paste + a separate CR, ~600ms quiescence — verified live.
  claude: { verified: true },
};

/** The input profile for a host id (default-merged). Unknown/absent → default. */
export function hostInputProfile(host?: string): HostInputProfile {
  return { ...DEFAULT_PROFILE, ...(host ? PROFILES[host] : null) };
}

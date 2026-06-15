// Pure, React-free helpers for the context-aware SessionComposer (U2). Kept
// here so the state selection + chip pre-fill text are unit-testable in the
// node-env vitest setup (no DOM mounting).

/** The composer has two states, derived from whether an agent is live. */
export type ComposerMode = "idle" | "active";

/**
 * Idle when nothing is running → show a real prompt box that starts a new
 * session with the typed task. Active when an agent is alive → collapse to a
 * status + Stop bar (you continue in the Terminal tab; terminal-first).
 *
 * Single-active-agent v1: there is at most one live agent, so this global
 * composer needs no per-viewed-session distinction — viewing a past/read-only
 * session simply leaves the composer idle (start a new session).
 */
export function composerMode(hasLiveAgent: boolean): ComposerMode {
  return hasLiveAgent ? "active" : "idle";
}

/** The idle prompt-box placeholder, naming the selected host so it's concrete. */
export function promptPlaceholder(hostLabel: string | undefined | null): string {
  return `What should ${hostLabel?.trim() || "your agent"} do?`;
}

/** A quick-start chip: clicking it PRE-FILLS the prompt box (it does not
 *  launch). `fill` is a real starter the user edits and sends — the chips are
 *  genuine choices, not three buttons that all do the same thing. */
export interface ComposerChip {
  label: string;
  fill: string;
}

export const QUICK_CHIPS: ComposerChip[] = [
  { label: "Explain this project", fill: "Explain what this project does and how it's structured." },
  { label: "Review the code", fill: "Review the code in this workspace and flag any issues." },
  { label: "Write tests", fill: "Add tests covering the recently changed code." },
];

/** True when there's an actual task to hand the host (Send is still allowed on
 *  empty — the host then just opens idle). Used to label/title the Send action. */
export function hasTask(prompt: string): boolean {
  return prompt.trim().length > 0;
}

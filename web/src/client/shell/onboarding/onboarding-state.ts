// shell/onboarding/onboarding-state.ts — the per-step consent gate (U3, plan
// 2026-06-29-001). PURE: maps the daemon's ProjectState + a durable consent record →
// the current onboarding step (which setup rung needs the user's explicit affirmative,
// what to narrate, or a resting end-state). The old flow auto-fired git-init → init →
// enable silently; this makes each a VISIBLE CONSENT (R13/R14) — the agent narrates,
// the user affirms, the daemon executes (KTD1). All branching lives here so the .tsx
// stays thin (mirrors project-home-state.ts). The server still owns the mechanical
// state (project-state.ts); this owns the consent gating over it.

import type { ProjectStateKind } from "#shared/index.js";

/** The privileged setup rungs that require explicit consent before the daemon runs them.
 *  (`session`/`review` from project-home-state's RUNGS are user actions, not gated POSTs.) */
export type PrepRungId = "git-init" | "init" | "enable";

/** A user's decision on a prep rung. Persisted durably (see PR5 / the durability note in
 *  U6) — NOT per-tab only, or deriveState re-marches a returning user through a declined step. */
export type ConsentDecision = "consented" | "declined";
export type ConsentRecord = Partial<Record<PrepRungId, ConsentDecision>>;

/** Load-bearing narration copy (R13/R14): one entry per prep rung. `body` explains WHAT
 *  the step does and WHY before it runs — the enable rung in particular must say it edits
 *  the host's config (R14). Copy lives here as data (the empty-copy.ts convention). */
export interface RungNarration {
  title: string;
  body: string;
  consentLabel: string;
}

export const RUNG_NARRATION: Record<PrepRungId, RungNarration> = {
  "git-init": {
    title: "Put this folder under git",
    body: "zuzuu tracks each session as a git branch and grows the brain in a tracked `.zuzuu/` folder — so it needs git. I'll run `git init` right here; nothing leaves your machine.",
    consentLabel: "Initialize git",
  },
  init: {
    title: "Create the brain (.zuzuu/)",
    body: "I'll run `zz init` to plant the Project: an empty brain plus the enforced guardrail safety floor. The brain stays empty until your work teaches it — I never pre-fill it.",
    consentLabel: "Create the brain",
  },
  enable: {
    title: "Let zuzuu watch your sessions",
    body: "I'll enable your agent's hooks so zuzuu can observe each session and propose changes you review. **This edits your host's config** (e.g. `.claude/settings.json`) to add the zuzuu hook — and every brain change still waits for your approval.",
    consentLabel: "Enable observing",
  },
};

/** The setup-route action key (api.setup.*) the daemon runs once a rung is consented. */
export const RUNG_ROUTE: Record<PrepRungId, "gitInit" | "init" | "enable"> = {
  "git-init": "gitInit",
  init: "init",
  enable: "enable",
};

/** The prep rung a not-yet-prepped mechanical state is waiting on, or null when prepped. */
export function prepRungFor(state: ProjectStateKind): PrepRungId | null {
  switch (state) {
    case "not-a-repo": return "git-init";
    case "no-project": return "init";
    case "hooks-off": return "enable";
    default: return null; // no-activity / steady — nothing to prep
  }
}

/** The onboarding step the UI should render. The single source of branching. */
export type OnboardingStep =
  /** A prep rung is waiting for the user's affirmative — render the narration + consent affordance. */
  | { kind: "awaiting-consent"; rung: PrepRungId; narration: RungNarration }
  /** The rung was consented; the daemon route is firing / state is being refetched. */
  | { kind: "executing"; rung: PrepRungId }
  /** Prepped (no-activity): pick a host and start the first real session. */
  | { kind: "ready" }
  /** A prep rung was declined — the brain is paused, observe is off, fully reversible (U6). */
  | { kind: "dormant"; declinedAt: PrepRungId }
  /** Steady: onboarding is over (the module-cards home takes over). */
  | { kind: "complete" };

/**
 * Derive the current onboarding step from the mechanical state + the durable consent record.
 * Pure + resumable: a returning user (any tab) recomputes the same step from the persisted
 * record, so they resume mid-sequence rather than restarting (PR5).
 */
export function onboardingStep(state: ProjectStateKind, consent: ConsentRecord): OnboardingStep {
  if (state === "steady") return { kind: "complete" };
  const rung = prepRungFor(state);
  if (!rung) return { kind: "ready" }; // no-activity — prepped, awaiting the first session
  const decision = consent[rung];
  if (decision === "declined") return { kind: "dormant", declinedAt: rung };
  if (decision === "consented") return { kind: "executing", rung };
  return { kind: "awaiting-consent", rung, narration: RUNG_NARRATION[rung] };
}

/** Record a consent decision (pure). Idempotent — re-affirming a rung is stable, so
 *  concurrent tabs / double-clicks don't corrupt the record. */
export function recordConsent(
  record: ConsentRecord,
  rung: PrepRungId,
  decision: ConsentDecision,
): ConsentRecord {
  return { ...record, [rung]: decision };
}

/** Clear a declined rung so it re-surfaces for consent — the "re-enable anytime" path
 *  out of the dormant end-state (U6). Pure. */
export function reopen(record: ConsentRecord, rung: PrepRungId): ConsentRecord {
  const next = { ...record };
  delete next[rung];
  return next;
}

/** Whether the onboarding conversation should still be shown (vs. the steady home). */
export function isOnboarding(step: OnboardingStep): boolean {
  return step.kind !== "complete";
}

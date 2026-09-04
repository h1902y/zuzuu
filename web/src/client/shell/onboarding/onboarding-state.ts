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

// Plain prose (no markdown) so it renders cleanly in the Checklist's plain Text today;
// U4's ACP conversation surface can enrich it later. Each body explains WHAT + WHY.
export const RUNG_NARRATION: Record<PrepRungId, RungNarration> = {
  "git-init": {
    title: "Put this folder under git",
    body: "zuzuu tracks each session as a git branch and grows the brain in a tracked .zuzuu/ folder, so it needs git. I'll run git init right here — nothing leaves your machine.",
    consentLabel: "Initialize git",
  },
  init: {
    title: "Create the brain (.zuzuu/)",
    body: "I'll create the Project home: an empty brain plus the enforced guardrail safety floor. The brain stays empty until your work teaches it — I never pre-fill it.",
    consentLabel: "Create the brain",
  },
  enable: {
    title: "Let zuzuu watch your sessions",
    body: "I'll enable your agent's hooks so zuzuu can observe each session and propose changes you review. This edits your host's config (like .claude/settings.json) to add the zuzuu hook — and every brain change still waits for your approval.",
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

/** A failed consented setup step, surfaced IN the onboarding surface (U6) — not a
 *  detached toast. A 503 means the zuzuu CLI is absent (the workbench can't self-heal
 *  that, so it isn't retryable); anything else is a command failure the user can retry. Pure. */
export interface SetupFailure {
  rung: PrepRungId;
  message: string;
  cliAbsent: boolean;
  retryable: boolean;
}

// ── U6 (curried-plotting-coral.md) — SetupPill's re-surface decision ───────────────
//
// Bug fix: the pill's `dismissed` flag used to reset via `useEffect(() => setDismissed
// (false), [step?.kind])` — but `onboardingStep` is a PURE function called fresh every
// render, so WorkbenchShell invalidating the whole `["zuzuu"]` query on every websocket
// brain-event recomputes a brand-new `step` object each time, and any transient blip
// (even landing back on the SAME kind/rung) could flip the effect's dependency and
// silently reopen a pill the user just dismissed with its X ("the X did nothing" —
// confirmed live). The fix: compare STEP IDENTITY (kind + the rung it names), not
// object identity, and only re-surface for a genuinely new, MORE URGENT identity than
// the one last dismissed — never for a recompute that lands back on the same step.

/** The comparable identity of an onboarding step — two steps with the same kind (and
 *  the same rung, where the step carries one) are THE SAME STEP even across a fresh
 *  recompute of a new object literal. */
export interface StepIdentity {
  kind: OnboardingStep["kind"];
  rung: PrepRungId | null;
}

/** Extract a step's identity (null for no step at all). */
export function stepIdentity(step: OnboardingStep | null): StepIdentity | null {
  if (!step) return null;
  if (step.kind === "awaiting-consent" || step.kind === "executing") return { kind: step.kind, rung: step.rung };
  if (step.kind === "dormant") return { kind: step.kind, rung: step.declinedAt };
  return { kind: step.kind, rung: null };
}

/** Urgency order for re-surfacing a dismissed pill — higher outranks lower. `dormant`
 *  (setup paused, the brain isn't observing) is the one state genuinely more pressing
 *  than a plain question; the rest sit at the same, non-interrupting baseline. */
const STEP_URGENCY: Record<OnboardingStep["kind"], number> = {
  "awaiting-consent": 0,
  executing: 0,
  dormant: 1,
  ready: 0,
  complete: 0,
};

/** Should a dismissed SetupPill re-surface for `current`, given the identity it was
 *  LAST dismissed at? `lastDismissed: null` means nothing has been dismissed yet this
 *  mount — always show. Otherwise: the SAME identity never re-surfaces (the exact bug
 *  this fixes — a recompute landing back on an unchanged step must stay dismissed),
 *  and a DIFFERENT identity only re-surfaces when it's strictly more urgent (a fresh
 *  "awaiting-consent" for the same rung the user already brushed off doesn't nag
 *  again; a genuine escalation to "dormant" does). */
export function shouldResurface(current: StepIdentity | null, lastDismissed: StepIdentity | null): boolean {
  if (!current) return false;
  if (!lastDismissed) return true;
  if (current.kind === lastDismissed.kind && current.rung === lastDismissed.rung) return false;
  return STEP_URGENCY[current.kind] > STEP_URGENCY[lastDismissed.kind];
}

export function describeSetupFailure(rung: PrepRungId, status: number): SetupFailure {
  if (status === 503) {
    return {
      rung,
      cliAbsent: true,
      retryable: false,
      message: "The zuzuu CLI isn't available, so the workbench can't run this step. Install zuzuu and reopen the project.",
    };
  }
  return {
    rung,
    cliAbsent: false,
    retryable: true,
    message: "That step didn't complete. You can try again — or check Settings if it keeps failing.",
  };
}

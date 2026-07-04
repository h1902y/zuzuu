// shell/onboarding/SetupPill.tsx — the NON-BLOCKING twin of the full-screen
// onboarding wall (bug fix). Before this, a project that was set up but not
// observing (hooks-off — declined the 3rd rung, OR set up via the CLI without
// `zz enable`) rendered a "Brain paused" card whose ONLY exit was "Re-enable
// setup": Escape, click-outside, and the header nav (Table/Map/Flow) all did
// nothing. But hooks-off means git + .zuzuu/ already exist — the brain is
// there to view/edit by hand; only agent-OBSERVING is off, a separate
// concern. So this renders the SAME per-rung Checklist body (narration +
// Affirm/Not-now, the "setting up…" beat, or the dormant "Brain paused" +
// Re-enable) — but as a small corner card that never captures the rest of
// the screen, and that the user can dismiss outright without deciding
// anything (a plain X, distinct from Affirm/Not-now/Re-enable). Mirrors
// HudPill's placement contract: absolutely positioned inside the stage's
// `relative` <main>.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Checklist } from "./Checklist.js";
import type { OnboardingStep, PrepRungId, SetupFailure } from "./onboarding-state.js";
import { Icon } from "../../ds/index.js";

export function SetupPill(props: {
  projectName: string;
  step: OnboardingStep | null;
  failure: SetupFailure | null;
  onAffirm: (rung: PrepRungId) => void;
  onDecline: (rung: PrepRungId) => void;
  onReopen: (rung: PrepRungId) => void;
  onRetry: () => void;
}) {
  const { step } = props;
  const [dismissed, setDismissed] = useState(false);
  // re-surface on a genuine step change (e.g. awaiting-consent → dormant) —
  // a dismiss is "not right now", not "never tell me about this step again"
  useEffect(() => { setDismissed(false); }, [step?.kind]);

  if (!step || step.kind === "complete" || step.kind === "ready" || dismissed) return null;

  return (
    <div className="animate-pop absolute bottom-4 right-4 z-30 w-80 max-w-full">
      <div className="relative rounded-lg shadow-overlay">
        <button
          type="button"
          aria-label="dismiss"
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 z-10 text-muted hover:text-ink-100"
        >
          <Icon icon={X} size={14} />
        </button>
        <Checklist
          projectName={props.projectName}
          companion
          step={step}
          failure={props.failure}
          onAffirm={props.onAffirm}
          onDecline={props.onDecline}
          onReopen={props.onReopen}
          onRetry={props.onRetry}
          onStartSession={() => { /* unreachable: "ready" is filtered out above */ }}
          starting={false}
        />
      </div>
    </div>
  );
}

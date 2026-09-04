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
//
// U6 (curried-plotting-coral.md) — bug fix: `dismissed` used to reset via a
// `useEffect` keyed on `step?.kind`, so ANY recompute of the (pure, freshly
// object-literal'd) onboarding step could silently reopen a card the user just
// closed — WorkbenchShell invalidates the whole `["zuzuu"]` query on every
// websocket brain-event, so this fired often ("the X did nothing" — confirmed
// live). Fixed by tracking the IDENTITY last dismissed and re-surfacing only for
// a genuinely new, more-urgent one (onboarding-state.ts's shouldResurface — see
// that file for the full rationale). Also new: outside-click dismissal
// (useDismiss) and a larger X hit target (was a bare 14px icon with no padding).
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Checklist } from "./Checklist.js";
import { stepIdentity, shouldResurface, type OnboardingStep, type PrepRungId, type SetupFailure, type StepIdentity } from "./onboarding-state.js";
import { Icon, useDismiss } from "../../ds/index.js";

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
  const [lastDismissed, setLastDismissed] = useState<StepIdentity | null>(null);
  const identity = stepIdentity(step);
  const dismissed = lastDismissed !== null && !shouldResurface(identity, lastDismissed);
  const ref = useRef<HTMLDivElement | null>(null);
  const dismiss = () => setLastDismissed(identity);
  const visible = !!step && step.kind !== "complete" && step.kind !== "ready" && !dismissed;

  // Called UNCONDITIONALLY, above the early return below (hooks can't be
  // conditional) — `enabled: visible` keeps a hidden/dismissed/absent pill off the
  // shared overlay stack entirely (Dialog/Popover's own pattern). U6 — outside-click
  // dismissal is new here; Escape (the default) is a welcome side effect too, same
  // "one intuitive contract" every overlay now shares.
  useDismiss({ id: "setup-pill", onClose: dismiss, closeOnOutside: true, enabled: visible, ref });

  if (!visible) return null;

  return (
    <div ref={ref} className="animate-pop absolute bottom-4 right-4 z-30 w-80 max-w-full">
      <div className="relative rounded-lg shadow-overlay">
        <button
          type="button"
          aria-label="dismiss"
          onClick={dismiss}
          className="absolute right-1 top-1 z-10 rounded-full p-2 text-muted hover:bg-surface hover:text-ink-100"
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

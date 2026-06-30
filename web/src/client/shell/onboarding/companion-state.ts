// shell/onboarding/companion-state.ts — the pinned-companion view model (U5). Onboarding
// stops being a full-stage takeover: it renders as a "Setup n/3" sidebar item + an in-home
// next-steps block (the consent narration), and completing the last rung reveals an
// in-place "start your first session" segue instead of hard-swapping to the dashboard.
// Pure: derives the label + segue from the mechanical state; the per-rung copy is reused
// from onboarding-state's RUNG_NARRATION (no duplication). Tested; the .tsx renders.
import type { ProjectStateKind } from "#shared/index.js";
import { prepRungFor, type PrepRungId } from "./onboarding-state.js";

/** The three setup rungs, in order — drives the "Setup n/3" progress label. */
export const SETUP_RUNGS: readonly PrepRungId[] = ["git-init", "init", "enable"];

export interface CompanionView {
  /** the pinned sidebar label, e.g. "Setup 2/3"; null once setup is complete */
  label: string | null;
  /** the rung whose next-steps block + consent the home should show; null when complete */
  rung: PrepRungId | null;
  /** show the in-place "start your first session" segue (an empty-brain affordance) */
  segue: boolean;
}

/** Derive the companion view from the mechanical state + the session count. While a setup
 *  rung is pending, show the "Setup n/3" pin + that rung's block. Once prepped (no-activity
 *  / steady), the label clears and the segue shows only until the first session exists. */
export function companionView(state: ProjectStateKind, sessionCount: number): CompanionView {
  const rung = prepRungFor(state);
  if (rung) {
    const n = SETUP_RUNGS.indexOf(rung) + 1;
    return { label: `Setup ${n}/${SETUP_RUNGS.length}`, rung, segue: false };
  }
  return { label: null, rung: null, segue: sessionCount === 0 };
}

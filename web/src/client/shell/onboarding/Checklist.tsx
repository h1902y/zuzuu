// shell/onboarding/Checklist.tsx — the in-canvas onboarding surface, now CONSENT-GATED
// (U3). It renders the current onboarding step (from onboarding-state.ts): a setup rung
// awaiting the user's affirmative (narration + Affirm / Not now), a "setting up…" beat
// while a consented route runs, the host picker once prepped, or the reversible dormant
// state after a decline. The old silent auto-prep is gone — every setup step is a VISIBLE
// CONSENT (R13/R14). Thin: all branching lives in onboarding-state.ts; this composes ds
// primitives. (U4 layers the ACP agent voice over this; the host picker scopes to Claude.)
import { RUNG_NARRATION, type OnboardingStep, type PrepRungId, type SetupFailure } from "./onboarding-state.js";
import { HOSTS } from "../../app/hosts.js";
import { Stack, Inline, Text, Button } from "../../ds/index.js";

interface ChecklistProps {
  projectName: string;
  /** the current onboarding step (null until project-state resolves). */
  step: OnboardingStep | null;
  /** a failed consented setup step (U6) — surfaced here with a Retry, not a toast. */
  failure: SetupFailure | null;
  /** affirm a setup rung — the daemon runs it; the conversation advances. */
  onAffirm: (rung: PrepRungId) => void;
  /** decline a setup rung — lands the reversible dormant state. */
  onDecline: (rung: PrepRungId) => void;
  /** re-open a declined rung from the dormant state ("re-enable anytime"). */
  onReopen: (rung: PrepRungId) => void;
  /** retry the failed setup step (re-fires the consented rung's route). */
  onRetry: () => void;
  /** pick a host (an agent session — zuzuu only observes agents) or a plain shell. */
  onStartSession: (type: "shell" | "agent", host?: string) => void;
  /** a session is being started (the host picker is disabled while it spins up). */
  starting: boolean;
}

export function Checklist(props: ChecklistProps) {
  return (
    <div className="h-full overflow-y-auto p-10">
      <div className="mx-auto w-full max-w-lg">
        <Body {...props} />
      </div>
    </div>
  );
}

function Body({ projectName, step, failure, onAffirm, onDecline, onReopen, onRetry, onStartSession, starting }: ChecklistProps) {
  if (!step || step.kind === "complete") {
    return <Text size="ui" tone="subtle">Loading…</Text>;
  }

  if (step.kind === "awaiting-consent") {
    const { rung, narration } = step;
    return (
      <Stack gap="xl">
        <Stack gap="sm">
          <Text size="2xl" font="display">{narration.title}</Text>
          <Text size="ui" tone="muted">{narration.body}</Text>
        </Stack>
        <Inline gap="sm">
          <Button variant="primary" size="md" onClick={() => onAffirm(rung)}>{narration.consentLabel}</Button>
          <Button variant="outline" size="md" onClick={() => onDecline(rung)}>Not now</Button>
        </Inline>
      </Stack>
    );
  }

  if (step.kind === "executing") {
    // U6: a failed step surfaces here (in the onboarding surface) with a Retry — not a toast.
    if (failure) {
      return (
        <Stack gap="xl">
          <Stack gap="sm">
            <Text size="2xl" font="display">Couldn't {RUNG_NARRATION[failure.rung].consentLabel.toLowerCase()}</Text>
            <Text size="ui" tone="danger">{failure.message}</Text>
          </Stack>
          <Inline gap="sm">
            {failure.retryable && <Button variant="primary" size="md" onClick={onRetry}>Try again</Button>}
            <Button variant="outline" size="md" onClick={() => onDecline(failure.rung)}>Not now</Button>
          </Inline>
        </Stack>
      );
    }
    return (
      <Stack gap="sm">
        <Text size="2xl" font="display">Setting up {projectName}…</Text>
        <Text size="ui" tone="subtle">One moment.</Text>
      </Stack>
    );
  }

  if (step.kind === "dormant") {
    const declinedAt = step.declinedAt;
    return (
      <Stack gap="xl">
        <Stack gap="sm">
          <Text size="2xl" font="display">Brain paused</Text>
          <Text size="ui" tone="muted">
            zuzuu isn't observing {projectName} — the brain is paused and stays empty until you re-enable it. Nothing was changed; you can pick this back up anytime.
          </Text>
        </Stack>
        <Button variant="primary" size="md" onClick={() => onReopen(declinedAt)}>Re-enable setup</Button>
      </Stack>
    );
  }

  // step.kind === "ready" — prepped; pick a host and start the first real session.
  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Text size="2xl" font="display">Start working on {projectName}</Text>
        <Text size="ui" tone="muted">
          Everything's set up. Pick your coding agent to begin — zuzuu watches the session and proposes changes you review, every one human-gated.
        </Text>
      </Stack>
      <Stack gap="sm">
        <Inline gap="xs" wrap>
          {HOSTS.map((h) => (
            <Button key={h.id} variant="outline" size="md" disabled={starting} onClick={() => onStartSession("agent", h.id)}>
              {h.label}
            </Button>
          ))}
        </Inline>
        <Text as="button" interactive size="meta" tone="muted" onClick={() => onStartSession("shell")}>
          or start a plain shell
        </Text>
      </Stack>
    </Stack>
  );
}

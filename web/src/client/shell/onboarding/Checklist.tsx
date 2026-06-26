// shell/onboarding/Checklist.tsx — the in-canvas onboarding (R4–R7), as a guided
// Stepper. The real setup verbs are the current step's CTA, advancing on TRUE state
// (the daemon-observed ProjectState → rungStatus). The copy reframes the tail: once
// the agent is connected, the remaining steps ARE the work — starting a session and
// reviewing what zuzuu proposes — so setup flows straight into the project experience.
// Thin .tsx; project-home-state is the tested logic; composes ds primitives + kit.
import type { ProjectStateKind } from "#shared/index.js";
import { RUNGS, rungStatus, type RungId } from "../project-home-state.js";
import { Stack, Text, Button, Stepper, type Step } from "../../ds/index.js";

const META: Record<RungId, { label: string; why: string; cta?: string }> = {
  "git-init": { label: "Make this a git repository", why: "zuzuu works on git branches — one per session.", cta: "git init" },
  init: { label: "Create the Project", why: "Plants .zuzuu/ — the project's memory, with the safety instructions.", cta: "Initialize" },
  enable: { label: "Connect your agent", why: "Wires your coding agent's hooks so zuzuu can observe and propose.", cta: "Enable" },
  session: { label: "Start working", why: "Begin a session — zuzuu watches it and learns. This is where setup becomes work.", cta: "Start a session" },
  review: { label: "Review what zuzuu proposes", why: "Nothing is written without your yes. Approve to teach it, reject to correct — that's the loop." },
};

export function Checklist({ projectName, state, onRung, busy }: {
  projectName: string;
  state: ProjectStateKind;
  onRung: (r: RungId) => void;
  busy: RungId | null;
}) {
  const done = RUNGS.filter((r) => rungStatus(state, r) === "done").length;
  const steps: Step[] = RUNGS.map((r) => ({
    id: r,
    label: META[r].label,
    hint: META[r].why,
    status: rungStatus(state, r),
    action: META[r].cta ? (
      <Button variant="primary" onClick={() => onRung(r)} disabled={busy === r}>
        {busy === r ? "…" : META[r].cta}
      </Button>
    ) : undefined,
  }));

  return (
    <div className="h-full overflow-y-auto p-10">
      <div className="mx-auto w-full max-w-lg">
        <Stack gap="xl">
          <Stack gap="sm">
            <Text size="meta" tone="subtle" weight="semibold">SETTING UP · {done} of {RUNGS.length}</Text>
            <Text size="2xl" font="display">Set up {projectName}</Text>
            <Text size="ui" tone="muted">zuzuu grows a brain for this folder from how you work — every change human-gated. The last steps are the work itself.</Text>
          </Stack>
          <Stepper steps={steps} />
        </Stack>
      </div>
    </div>
  );
}

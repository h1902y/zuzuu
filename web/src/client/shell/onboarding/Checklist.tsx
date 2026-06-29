// shell/onboarding/Checklist.tsx — the in-canvas onboarding, streamlined. The
// mechanical prep (git-init → init → enable) runs AUTOMATICALLY when a folder is
// opened (WorkbenchShell's auto-prep effect advances the ProjectState), so this
// surface has just two faces: a brief "Setting up…" while prep runs, then the ONE
// decision — pick a host and the first session starts. The old five-step Stepper
// (manual git/init/enable/review clicks) is gone. Thin .tsx; HOSTS is the data.
import type { ProjectStateKind } from "#shared/index.js";
import { HOSTS } from "../../app/hosts.js";
import { Stack, Inline, Text, Button } from "../../ds/index.js";

// the prep states the auto-prep effect drives through before the project is ready;
// `no-activity` (prepped, no session yet) is where the user picks a host.
const PREP_STATES = new Set<ProjectStateKind>(["not-a-repo", "no-project", "hooks-off"]);

export function Checklist({ projectName, state, onStartSession, starting }: {
  projectName: string;
  state: ProjectStateKind;
  /** pick a host (an agent session — zuzuu only observes agents) or a plain shell. */
  onStartSession: (type: "shell" | "agent", host?: string) => void;
  /** a session is being started (the host picker is disabled while it spins up). */
  starting: boolean;
}) {
  const preparing = PREP_STATES.has(state);

  return (
    <div className="h-full overflow-y-auto p-10">
      <div className="mx-auto w-full max-w-lg">
        <Stack gap="xl">
          <Stack gap="sm">
            <Text size="2xl" font="logo">
              {preparing ? `Setting up ${projectName}…` : `Start working on ${projectName}`}
            </Text>
            <Text size="ui" tone="muted">
              {preparing
                ? "Preparing the project — git, the brain (.zuzuu/), and your agent's hooks. One moment."
                : "Everything's set up. Pick your coding agent to begin — zuzuu watches the session and proposes changes you review, every one human-gated."}
            </Text>
          </Stack>

          {preparing ? (
            <Text size="ui" tone="subtle">setting up…</Text>
          ) : (
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
          )}
        </Stack>
      </div>
    </div>
  );
}

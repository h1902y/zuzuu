// shell/onboarding/Checklist.tsx — the in-canvas onboarding checklist (R4–R7).
// The real setup verbs as buttons, advancing on TRUE state (the daemon-observed
// ProjectState → rungStatus). Completed rungs collapse to ✓ receipts; the current
// rung shows its CTA. Teaching is by-doing — rung ④ (review) has no CTA: it
// completes when the first proposal lands (the ribbon carries it). Notion-calm:
// color marks state only. Composes only from ds primitives + kit.
import type { ProjectStateKind } from "#shared/index.js";
import { Check, Circle, CircleDot, type LucideIcon } from "lucide-react";
import { RUNGS, rungStatus, type RungId } from "../project-home-state.js";
import { Stack, Inline, Text, Button, Icon } from "../../ds/index.js";

const META: Record<RungId, { label: string; why: string; cta?: string }> = {
  "git-init": { label: "Make this folder a repository", why: "a session is a git branch", cta: "git init" },
  init: { label: "Initialize the Project", why: "plant .zuzuu/ and the guardrails floor", cta: "Initialize" },
  enable: { label: "Enable your agent", why: "wire your host’s lifecycle hooks", cta: "Enable" },
  session: { label: "Start a session", why: "zuzuu watches it and proposes", cta: "Start a session" },
  review: { label: "Review your first proposal", why: "nothing is written without your yes" },
};

const MARK: Record<"done" | "current" | "upcoming", LucideIcon> = { done: Check, current: CircleDot, upcoming: Circle };

export function Checklist({ state, onRung, busy }: {
  state: ProjectStateKind;
  onRung: (r: RungId) => void;
  busy: RungId | null;
}) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <Stack gap="lg">
        <Stack gap="xs">
          <Text size="lg" font="display">Set up this Project</Text>
          <Text size="ui" tone="muted">zuzuu grows a brain for this folder from how you work — every change human-gated.</Text>
        </Stack>
        <Stack gap="md">
          {RUNGS.map((r) => {
            const st = rungStatus(state, r);
            const meta = META[r];
            return (
              <Inline key={r} gap="sm" align="start">
                <Text tone={st === "done" ? "accent" : st === "current" ? "default" : "muted"}><Icon icon={MARK[st]} size={15} /></Text>
                <Stack gap="xs">
                  <Text size="ui" weight={st === "current" ? "medium" : "normal"} tone={st === "upcoming" ? "muted" : "default"}>
                    {meta.label}
                  </Text>
                  <Text size="meta" tone="muted">{meta.why}</Text>
                  {st === "current" && meta.cta && (
                    <Inline gap="xs">
                      <Button variant="primary" onClick={() => onRung(r)} disabled={busy === r}>
                        {busy === r ? "…" : meta.cta}
                      </Button>
                    </Inline>
                  )}
                </Stack>
              </Inline>
            );
          })}
        </Stack>
      </Stack>
    </div>
  );
}

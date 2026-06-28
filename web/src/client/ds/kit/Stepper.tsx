// ds/kit/Stepper.tsx — a vertical, connected stepper. Each step has a marker (done ✓ /
// current ● / upcoming ○) joined by a rail line, a label + optional hint, and an
// optional action rendered only on the current step. One guided-progress treatment for
// onboarding + any sequential flow. Composes ds primitives + Icon; static utilities only.
import type { ReactNode } from "react";
import { Check, CircleDot, Circle, type LucideIcon } from "lucide-react";
import { Stack, Text } from "../primitives/index.js";
import { Icon } from "./Icon.js";

export type StepStatus = "done" | "current" | "upcoming";

export interface Step {
  id: string;
  label: string;
  hint?: string;
  status: StepStatus;
  /** rendered under the label only when this step is current (e.g. its CTA). */
  action?: ReactNode;
}

const MARK: Record<StepStatus, LucideIcon> = { done: Check, current: CircleDot, upcoming: Circle };

export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <div>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const markTone = s.status === "done" ? "accent" : s.status === "current" ? "default" : "muted";
        return (
          <div key={s.id} className="flex gap-3">
            {/* the rail: marker + a connector line down to the next step */}
            <div className="flex flex-col items-center">
              <Text tone={markTone}><Icon icon={MARK[s.status]} size={16} /></Text>
              {!last && <div className="w-px flex-1 bg-border" />}
            </div>
            {/* content */}
            <div className={last ? "pb-0" : "pb-6"}>
              <Stack gap="xs">
                <Text size="ui" weight={s.status === "current" ? "medium" : "normal"} tone={s.status === "upcoming" ? "muted" : "default"}>
                  {s.label}
                </Text>
                {s.hint && <Text size="meta" tone="muted">{s.hint}</Text>}
                {s.status === "current" && s.action && <div className="pt-1">{s.action}</div>}
              </Stack>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ds/kit/conversation.tsx — the CONVERSATION surface kit. The structured ACP stream's
// renderable primitives, graduated out of the AcpView spike (raw utility classes) into
// the design system: one token-bound, reusable component per block kind — agent message ·
// thought · tool-call card (+ diff) · plan · permission card · gate notice · turn divider ·
// error. This is what lets the LIVE agent conversation be governed by the same tokens as
// every other workbench surface (no terminal-shaped hole left for the DS). Composes ds
// primitives + kit; token-bound utilities only where the primitives don't reach (code
// <pre>, the top-only divider) — the Chip/ListCard convention, guard-safe.
import { Brain, Wrench, ListChecks, ShieldQuestion, ShieldCheck, ShieldX, TriangleAlert, Check, Circle } from "lucide-react";
import { Box, Stack, Inline, Text } from "../primitives/index.js";
import { Icon } from "./Icon.js";
import { Chip, type ChipTone } from "./Chip.js";
import { Button } from "./Button.js";
import { Markdown } from "./Markdown.js";

/** A structured file diff hunk — the shape `tool_call` content carries. */
export interface DiffHunk { path: string; oldText?: string; newText: string }

/** tool-call status → the Chip tone that carries its urgency (color = state). Pure. */
export function toolStatusTone(status: string): ChipTone {
  switch (status) {
    case "completed": return "success";
    case "failed": return "danger";
    case "in_progress": return "warning";
    default: return "neutral"; // pending / unknown
  }
}

/** An agent message — rendered as markdown (agent output IS markdown, not plain text). */
export function AgentMessage({ text }: { text: string }) {
  return <Markdown>{text}</Markdown>;
}

/** A reasoning/thought chunk — de-emphasised, set apart by the brain glyph. */
export function Thought({ text }: { text: string }) {
  return (
    <Inline gap="sm" align="start">
      <Icon icon={Brain} size={14} />
      <div className="whitespace-pre-wrap text-ui italic text-muted">{text}</div>
    </Inline>
  );
}

/** One structured diff: the path label + the new content (and the prior, when present). */
export function Diff({ path, oldText, newText }: DiffHunk) {
  return (
    <Stack gap="xs">
      <Text size="meta" tone="subtle" font="data">{path}</Text>
      {oldText !== undefined && oldText !== "" && (
        <pre className="max-h-32 overflow-auto rounded-sm border-l-2 border-danger bg-app p-2 text-meta text-muted font-mono-data">{oldText}</pre>
      )}
      <pre className="max-h-48 overflow-auto rounded-sm border-l-2 border-success bg-app p-2 text-meta text-subtle font-mono-data">{newText}</pre>
    </Stack>
  );
}

/** A tool call — title, kind + status chips, and any inline diffs. */
export function ToolCallCard({ title, toolKind, status, diffs }: {
  title: string; toolKind: string; status: string; diffs: DiffHunk[];
}) {
  return (
    <Box border="hairline" bg="surface" radius="ui" pad="md">
      <Stack gap="sm">
        <Inline gap="sm" align="center">
          <Icon icon={Wrench} size={14} />
          <Text size="ui" weight="semibold" truncate>{title}</Text>
          <Chip label={toolKind} tone="neutral" />
          <Chip label={status} tone={toolStatusTone(status)} />
        </Inline>
        {diffs.map((d, i) => <Diff key={i} {...d} />)}
      </Stack>
    </Box>
  );
}

/** The agent's plan — a checklist whose completed steps recede. */
export function PlanList({ entries }: { entries: Array<{ content: string; status?: string }> }) {
  return (
    <Box border="hairline" bg="surface" radius="ui" pad="md">
      <Stack gap="sm">
        <Inline gap="sm" align="center">
          <Icon icon={ListChecks} size={14} />
          <Text size="meta" tone="subtle" weight="semibold">PLAN</Text>
        </Inline>
        <Stack gap="xs">
          {entries.map((e, i) => (
            <Inline key={i} gap="sm" align="start">
              <Icon icon={e.status === "completed" ? Check : Circle} size={13} />
              <Text size="ui" tone={e.status === "completed" ? "muted" : "default"}>{e.content}</Text>
            </Inline>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

/** The human gate, in-band: a tool call awaiting an explicit Allow/Deny (or its decision). */
export function PermissionCard({ title, toolKind, reason, decision, onAllow, onDeny }: {
  title: string;
  toolKind: string;
  reason?: string;
  decision?: "allow" | "deny";
  onAllow: () => void;
  onDeny: () => void;
}) {
  return (
    <Box border="strong" bg="surface" radius="ui" pad="md">
      <Stack gap="sm">
        <Inline gap="sm" align="center">
          <Icon icon={ShieldQuestion} size={14} />
          <Text size="ui" weight="semibold">Permission</Text>
          <Text size="ui" tone="muted" truncate>{title}</Text>
          <Chip label={toolKind} tone="neutral" />
        </Inline>
        {reason && <Text size="meta" tone="muted">{reason}</Text>}
        {decision ? (
          <Inline gap="xs" align="center">
            <Icon icon={decision === "allow" ? ShieldCheck : ShieldX} size={14} />
            <Text size="meta" tone={decision === "allow" ? "subtle" : "danger"}>
              {decision === "allow" ? "Allowed" : "Denied"}
            </Text>
          </Inline>
        ) : (
          <Inline gap="sm">
            <Button variant="primary" size="sm" onClick={onAllow}>Allow</Button>
            <Button variant="danger" size="sm" onClick={onDeny}>Deny</Button>
          </Inline>
        )}
      </Stack>
    </Box>
  );
}

/** A gate auto-decision (a rule fired) — blocked, or allowed-by-rule. */
export function GateNotice({ decision, title, reason }: {
  decision: "deny" | "allow"; title: string; reason: string;
}) {
  const denied = decision === "deny";
  return (
    <Inline gap="sm" align="center">
      <Icon icon={denied ? ShieldX : ShieldCheck} size={14} />
      <Text size="ui" tone={denied ? "danger" : "subtle"}>
        {denied ? "Blocked" : "Allowed by rule"} · {title}
      </Text>
      <Text size="meta" tone="muted">{reason}</Text>
    </Inline>
  );
}

/** The end of a turn — a quiet divider carrying the stop reason. */
export function TurnDivider({ stopReason }: { stopReason: string }) {
  return (
    <div className="border-t border-border pt-2">
      <Text size="meta" tone="muted">— {stopReason} —</Text>
    </div>
  );
}

/** A stream error. */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <Inline gap="sm" align="start">
      <Icon icon={TriangleAlert} size={14} />
      <Text size="ui" tone="danger">{message}</Text>
    </Inline>
  );
}

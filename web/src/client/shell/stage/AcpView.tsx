// shell/stage/AcpView.tsx — the ACP drive-lane stage (Spike #2). Connects to
// /ws/acp/:id, folds the structured stream through acp-model (pure), and renders it as
// a custom conversation surface OFF the host TUI: agent text, thoughts, tool-call cards
// with a status lifecycle + inline diffs, plans, turn dividers — plus a composer.
// The in-memory view-model IS the recordable trace. Thin: derivation lives in acp-model.
import { useEffect, useReducer, useRef, useState } from "react";
import { Send, Wrench, Brain, ListChecks, TriangleAlert, CircleDot, ShieldQuestion, ShieldX, ShieldCheck } from "lucide-react";
import { AcpConnection } from "../../lib/acp-client.js";
import { applyAcpMessage, initialAcpView, type AcpView as AcpVM, type Block } from "./acp-model.js";
import { Stack, Inline, Text, Button, Icon } from "../../ds/index.js";

const TOOL_STATUS_TONE: Record<string, string> = {
  completed: "text-success", failed: "text-danger", in_progress: "text-warning", pending: "text-muted",
};

export function AcpView({ id }: { id: string }) {
  const [vm, dispatch] = useReducer(applyAcpMessage, initialAcpView);
  const [draft, setDraft] = useState("");
  const [decided, setDecided] = useState<Record<string, "allow" | "deny">>({});
  const connRef = useRef<AcpConnection | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const decide = (requestId: string, decision: "allow" | "deny") => {
    connRef.current?.send({ type: "permission", requestId, decision });
    setDecided((d) => ({ ...d, [requestId]: decision }));
  };

  useEffect(() => {
    const conn = new AcpConnection(id, (m) => dispatch(m));
    connRef.current = conn;
    conn.connect();
    return () => conn.close();
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [vm.blocks.length]);

  const send = () => {
    const text = draft.trim();
    if (!text || vm.status === "working") return;
    connRef.current?.send({ type: "prompt", text });
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-6 py-3">
        <Icon icon={CircleDot} size={14} />
        <Text size="meta" weight="semibold">Agent (ACP)</Text>
        <Text size="meta" tone="muted">· {vm.status}</Text>
        {vm.usage?.totalTokens != null && (
          <Text size="meta" tone="subtle">· {vm.usage.totalTokens.toLocaleString()} tok</Text>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {!vm.blocks.length ? (
          <Text tone="muted" size="ui">{vm.ready ? "Ready — send a prompt below." : "Connecting to the agent…"}</Text>
        ) : (
          <Stack gap="md">
            {vm.blocks.map((b, i) => <BlockView key={i} b={b} decided={decided} onDecide={decide} />)}
          </Stack>
        )}
      </div>

      <div className="flex shrink-0 items-end gap-2 border-t border-border px-6 py-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message the agent…"
          rows={1}
          className="min-h-9 max-h-40 w-full resize-none rounded-ui border border-border bg-app px-3 py-2 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
        />
        <Button variant="primary" size="sm" disabled={!draft.trim() || vm.status === "working"} onClick={send}>
          <Icon icon={Send} size={15} /> Send
        </Button>
      </div>
    </div>
  );
}

function BlockView({ b, decided, onDecide }: {
  b: Block;
  decided: Record<string, "allow" | "deny">;
  onDecide: (requestId: string, decision: "allow" | "deny") => void;
}) {
  switch (b.kind) {
    case "permission": {
      const answer = decided[b.requestId];
      return (
        <div className="rounded-ui border border-accent-dim bg-surface p-3">
          <Inline gap="sm" align="center">
            <Icon icon={ShieldQuestion} size={14} />
            <Text size="ui" weight="semibold">Permission · {b.title}</Text>
            <Text size="meta" tone="muted">{b.toolKind}</Text>
          </Inline>
          {b.reason && <Text size="meta" tone="muted">{b.reason}</Text>}
          {answer ? (
            <Text size="meta" tone={answer === "allow" ? "subtle" : "danger"}>{answer === "allow" ? "✓ allowed" : "✗ denied"}</Text>
          ) : (
            <Inline gap="sm">
              <Button variant="primary" size="sm" onClick={() => onDecide(b.requestId, "allow")}>Allow</Button>
              <Button variant="outline" size="sm" onClick={() => onDecide(b.requestId, "deny")}>Deny</Button>
            </Inline>
          )}
        </div>
      );
    }
    case "gate":
      return (
        <Inline gap="sm" align="center">
          <Icon icon={b.decision === "deny" ? ShieldX : ShieldCheck} size={14} />
          <Text size="ui" tone={b.decision === "deny" ? "danger" : "subtle"}>
            {b.decision === "deny" ? "Blocked" : "Allowed by rule"} · {b.title}
          </Text>
          <Text size="meta" tone="muted">{b.reason}</Text>
        </Inline>
      );
    case "agent":
      return <div className="whitespace-pre-wrap text-ui text-ink-100">{b.text}</div>;
    case "thought":
      return (
        <Inline gap="sm" align="start">
          <Icon icon={Brain} size={14} />
          <div className="whitespace-pre-wrap text-ui text-muted italic">{b.text}</div>
        </Inline>
      );
    case "tool":
      return (
        <div className="rounded-ui border border-border bg-surface p-3">
          <Inline gap="sm" align="center">
            <Icon icon={Wrench} size={14} />
            <Text size="ui" weight="semibold">{b.title || b.id}</Text>
            <Text size="meta" tone="muted">{b.toolKind}</Text>
            <span className={`text-meta ${TOOL_STATUS_TONE[b.status] ?? "text-muted"}`}>{b.status}</span>
          </Inline>
          {b.diffs.map((d, i) => (
            <div key={i} className="mt-2">
              <Text size="meta" tone="subtle" mono>{d.path}</Text>
              <pre className="mt-1 max-h-48 overflow-auto rounded-sm bg-app p-2 text-meta text-subtle">{d.newText}</pre>
            </div>
          ))}
        </div>
      );
    case "plan":
      return (
        <div className="rounded-ui border border-border bg-surface p-3">
          <Inline gap="sm" align="center"><Icon icon={ListChecks} size={14} /><Text size="meta" tone="subtle" weight="semibold">PLAN</Text></Inline>
          <Stack gap="xs">
            {b.entries.map((e, i) => (
              <Text key={i} size="ui" tone={e.status === "completed" ? "muted" : "default"}>
                {e.status === "completed" ? "✓ " : "• "}{e.content}
              </Text>
            ))}
          </Stack>
        </div>
      );
    case "turn":
      return <div className="border-t border-border pt-2"><Text size="meta" tone="muted">— {b.stopReason} —</Text></div>;
    case "error":
      return (
        <Inline gap="sm" align="start">
          <Icon icon={TriangleAlert} size={14} />
          <Text size="ui" tone="danger">{b.message}</Text>
        </Inline>
      );
    default:
      return null;
  }
}

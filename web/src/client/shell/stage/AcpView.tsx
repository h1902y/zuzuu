// shell/stage/AcpView.tsx — the ACP drive-lane stage. Connects to /ws/acp/:id, folds the
// structured stream through acp-model (pure), and renders it as a custom conversation
// surface OFF the host TUI. The block renderers are now the ds CONVERSATION KIT
// (AgentMessage · Thought · ToolCallCard · PlanList · PermissionCard · GateNotice ·
// TurnDivider · ErrorNotice) — so the live agent conversation is token-governed like every
// other surface. This file is thin: derivation lives in acp-model, presentation in the kit.
import { useEffect, useReducer, useRef, useState } from "react";
import { Send, CircleDot } from "lucide-react";
import { AcpConnection } from "../../lib/acp-client.js";
import { applyAcpMessage, initialAcpView, type Block } from "./acp-model.js";
import {
  Stack, Text, Button, Icon,
  AgentMessage, Thought, ToolCallCard, PlanList, PermissionCard, GateNotice, TurnDivider, ErrorNotice,
} from "../../ds/index.js";

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

/** A thin dispatcher: each block kind → its conversation-kit component. */
function BlockView({ b, decided, onDecide }: {
  b: Block;
  decided: Record<string, "allow" | "deny">;
  onDecide: (requestId: string, decision: "allow" | "deny") => void;
}) {
  switch (b.kind) {
    case "agent":
      return <AgentMessage text={b.text} />;
    case "thought":
      return <Thought text={b.text} />;
    case "tool":
      return <ToolCallCard title={b.title || b.id} toolKind={b.toolKind} status={b.status} diffs={b.diffs} />;
    case "plan":
      return <PlanList entries={b.entries} />;
    case "permission":
      return (
        <PermissionCard
          title={b.title}
          toolKind={b.toolKind}
          {...(b.reason ? { reason: b.reason } : {})}
          {...(decided[b.requestId] ? { decision: decided[b.requestId] } : {})}
          onAllow={() => onDecide(b.requestId, "allow")}
          onDeny={() => onDecide(b.requestId, "deny")}
        />
      );
    case "gate":
      return <GateNotice decision={b.decision} title={b.title} reason={b.reason} />;
    case "turn":
      return <TurnDivider stopReason={b.stopReason} />;
    case "error":
      return <ErrorNotice message={b.message} />;
    default:
      return null;
  }
}

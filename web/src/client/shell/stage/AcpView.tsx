// shell/stage/AcpView.tsx — the ACP drive lane. Connects to /ws/acp/:id, folds the
// structured stream through acp-model (pure), and renders it as a custom conversation
// surface OFF the host TUI: agent text, thoughts, tool-call cards with a status
// lifecycle + inline diffs, plans, turn dividers — plus a composer.
// TWO surfaces mount the SAME machinery (§E.1 stage 3 — enhance, never reinvent):
// the full stage (AcpView) and the omnibar's chat panel (AcpConversation compact).
// They share the session — the daemon replays its trace to a (re)joining socket, so
// closing the panel loses nothing; the conversation continues in the background.
import { useEffect, useReducer, useRef, useState } from "react";
import { Send, Square, Wrench, Brain, ListChecks, TriangleAlert, CircleDot, ShieldQuestion, ShieldX, ShieldCheck, X } from "lucide-react";
import { AcpConnection } from "../../lib/acp-client.js";
import { useAcpIntent } from "../../state/acp-intent.js";
import { useWorldCommand } from "../../state/world-command.js";
import { useWorld } from "../world-state.js";
import { applyAcpMessage, extractMentions, initialAcpView, type AcpView as AcpVM, type Block } from "./acp-model.js";
import { Stack, Inline, Text, Button, Icon, useDismiss } from "../../ds/index.js";

const TOOL_STATUS_TONE: Record<string, string> = {
  completed: "text-success", failed: "text-danger", in_progress: "text-warning", pending: "text-muted",
};

/** The stage wrapper: header + the shared conversation surface, PLUS a real exit
 *  (U6, curried-plotting-coral.md) — the compose textarea below has no Escape of its
 *  own, and the shell's global Escape handler deliberately bails on a focused
 *  INPUT/TEXTAREA (WorkbenchShell.tsx, to protect the real terminal's typing), so
 *  Escape used to do NOTHING while chatting ("sticky" — confirmed live). Fixed by
 *  registering this stage via `useDismiss`: its window `keydown` listener
 *  (use-dismiss.ts) has no textarea guard at all, so it closes/backs out of THIS view
 *  even mid-compose — without loosening the shell's own guard (still checked first,
 *  still returns early for the terminal's own Escape branch) and without touching the
 *  real `New shell` terminal (a completely different stage, never a useDismiss
 *  overlay — TermView is untouched by this change). `closeOnOutside` stays off: this
 *  is a full-stage view, not a floating panel — there's no scrim, and the "outside"
 *  would just be the app header/footer chrome, where an incidental click (Settings,
 *  the project switcher) shouldn't silently drop the conversation. The visible X
 *  below is the discoverable twin of the Escape keystroke.
 */
export function AcpView({ id }: { id: string }) {
  const select = useWorld((s) => s.select);
  const ref = useRef<HTMLDivElement | null>(null);
  const onClose = () => select(null); // back to the World home — the same "clear selection" exit Escape uses everywhere else
  useDismiss({ id: "acp", onClose, closeOnOutside: false, ref });
  return (
    <div ref={ref} className="flex h-full min-h-0 flex-col">
      <AcpConversation id={id} onClose={onClose} />
    </div>
  );
}

/** The conversation surface both the stage and the omnibar chat panel mount.
 *  `compact` tightens paddings for the panel. `onClose` (stage-only — the omnibar's
 *  compact panel omits it and gets no button here; it already backs out via the
 *  palette's own Esc/view-stack pop) renders the visible dismiss affordance in the
 *  header. */
export function AcpConversation({ id, compact = false, onClose }: { id: string; compact?: boolean; onClose?: () => void }) {
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

  // the omnibar's `/prompt` hand-off (C3): one-shot — take() empties the queue,
  // so a re-render can never double-send.
  const takeIntent = useAcpIntent((s) => s.take);
  useEffect(() => {
    if (!vm.ready) return;
    const queued = takeIntent();
    if (queued) connRef.current?.send({ type: "prompt", text: queued });
  }, [vm.ready, takeIntent]);

  // [[mention]]s in the agent's streamed prose light the map (C3 follow-up):
  // scan the coalesced agent blocks (chunks can split a mention mid-`[[…]]`, so
  // per-chunk scanning would miss them), dispatch only the not-yet-seen ones.
  // The world-command glow slot no-ops safely when the World is off-stage.
  const requestGlow = useWorldCommand((s) => s.requestGlow);
  const glowSeen = useRef(new Set<string>());
  useEffect(() => { glowSeen.current = new Set(); }, [id]); // fresh session, fresh slate
  useEffect(() => {
    const prose = vm.blocks.filter((b) => b.kind === "agent").map((b) => b.text).join("\n");
    const fresh = extractMentions(prose).filter((m) => !glowSeen.current.has(m));
    if (!fresh.length) return;
    for (const m of fresh) glowSeen.current.add(m);
    requestGlow(fresh);
  }, [vm.blocks, requestGlow]);

  const send = () => {
    const text = draft.trim();
    if (!text || vm.status === "working") return;
    connRef.current?.send({ type: "prompt", text });
    setDraft("");
  };

  const pad = compact ? "px-3" : "px-6";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex shrink-0 items-center gap-2 border-b border-border ${pad} ${compact ? "py-2" : "py-3"}`}>
        <Icon icon={CircleDot} size={14} />
        <Text size="meta" weight="semibold">Agent (ACP)</Text>
        <Text size="meta" tone="muted">· {vm.status}</Text>
        {vm.usage?.totalTokens != null && (
          <Text size="meta" tone="subtle">· {vm.usage.totalTokens.toLocaleString()} tok</Text>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="close agent view"
            title="Close (Esc)"
            className="ml-auto rounded-ui p-1 text-muted hover:bg-surface hover:text-ink-100"
          >
            <Icon icon={X} size={14} />
          </button>
        )}
      </div>

      <div ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto ${pad} py-4`}>
        {!vm.blocks.length ? (
          <Text tone="muted" size="ui">{vm.ready ? "Ready — send a prompt below." : "Connecting to the agent…"}</Text>
        ) : (
          <Stack gap="md">
            {vm.blocks.map((b, i) => <BlockView key={i} b={b} decided={decided} onDecide={decide} />)}
          </Stack>
        )}
      </div>

      <div className={`flex shrink-0 items-end gap-2 border-t border-border ${pad} ${compact ? "py-2" : "py-3"}`}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message the agent…"
          rows={1}
          className="min-h-9 max-h-40 w-full resize-none rounded-ui border border-border bg-app px-3 py-2 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
        />
        {vm.status === "working" ? (
          // status-aware submit (AI Elements pattern): Stop while the turn streams —
          // cancel is already wired (client {type:"cancel"} → AcpSession.cancel()).
          <Button variant="outline" size="sm" onClick={() => connRef.current?.send({ type: "cancel" })}>
            <Icon icon={Square} size={14} /> Stop
          </Button>
        ) : (
          <Button variant="primary" size="sm" disabled={!draft.trim()} onClick={send}>
            <Icon icon={Send} size={15} /> Send
          </Button>
        )}
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

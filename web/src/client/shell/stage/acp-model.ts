// shell/stage/acp-model.ts — fold the ACP server stream into a render view-model.
// Pure (tested); AcpView.tsx renders it. Turns the structured AcpServerMessage stream
// (the daemon's relayed session/update + ready/turn_end/error) into ordered blocks a
// custom UI renders — agent text (coalesced), thoughts, tool-call cards with a status
// lifecycle + inline diffs, plans, turn dividers, errors — i.e. the structured surface
// the host TUI can't give us, and the raw material for a trace.
import type { AcpServerMessage, AcpSessionUpdate, AcpToolCall, AcpUsage } from "#shared/index.js";

export interface DiffHunk { path: string; oldText?: string; newText: string }
export type Block =
  | { kind: "agent"; text: string }
  | { kind: "thought"; text: string }
  | { kind: "tool"; id: string; title: string; toolKind: string; status: string; diffs: DiffHunk[] }
  | { kind: "plan"; entries: Array<{ content: string; status?: string }> }
  | { kind: "turn"; stopReason: string }
  | { kind: "error"; message: string };

export interface AcpView {
  ready: boolean;
  status: "connecting" | "ready" | "working" | "idle" | "error";
  blocks: Block[];
  usage?: AcpUsage;
}

export const initialAcpView: AcpView = { ready: false, status: "connecting", blocks: [] };

function diffsOf(tc: AcpToolCall | undefined): DiffHunk[] {
  const out: DiffHunk[] = [];
  for (const b of tc?.content ?? []) {
    if (b && b["type"] === "diff" && typeof b["path"] === "string") {
      out.push({
        path: b["path"] as string,
        ...(typeof b["oldText"] === "string" ? { oldText: b["oldText"] as string } : {}),
        newText: typeof b["newText"] === "string" ? (b["newText"] as string) : "",
      });
    }
  }
  return out;
}

function applyUpdate(v: AcpView, u: AcpSessionUpdate): AcpView {
  const blocks = v.blocks;
  switch (u.sessionUpdate) {
    case "agent_message_chunk": {
      const text = u.content?.text ?? "";
      if (!text) return v;
      const last = blocks[blocks.length - 1];
      if (last?.kind === "agent") {
        return { ...v, status: "working", blocks: [...blocks.slice(0, -1), { ...last, text: last.text + text }] };
      }
      return { ...v, status: "working", blocks: [...blocks, { kind: "agent", text }] };
    }
    case "agent_thought_chunk": {
      const text = u.content?.text ?? "";
      if (!text) return v;
      const last = blocks[blocks.length - 1];
      if (last?.kind === "thought") {
        return { ...v, status: "working", blocks: [...blocks.slice(0, -1), { ...last, text: last.text + text }] };
      }
      return { ...v, status: "working", blocks: [...blocks, { kind: "thought", text }] };
    }
    case "tool_call":
    case "tool_call_update": {
      const tc = (u.toolCall ?? (u as unknown as { toolCall?: AcpToolCall }).toolCall ?? (u as unknown as AcpToolCall)) as AcpToolCall;
      const id = String(tc.toolCallId ?? "");
      if (!id) return v;
      const idx = blocks.findIndex((b) => b.kind === "tool" && b.id === id);
      const merged = {
        kind: "tool" as const,
        id,
        title: tc.title ?? (idx >= 0 ? (blocks[idx] as { title: string }).title : id),
        toolKind: tc.kind ?? (idx >= 0 ? (blocks[idx] as { toolKind: string }).toolKind : "other"),
        status: tc.status ?? (idx >= 0 ? (blocks[idx] as { status: string }).status : "pending"),
        diffs: (() => { const d = diffsOf(tc); return d.length ? d : idx >= 0 ? (blocks[idx] as { diffs: DiffHunk[] }).diffs : []; })(),
      };
      const next = idx >= 0 ? blocks.map((b, i) => (i === idx ? merged : b)) : [...blocks, merged];
      return { ...v, status: "working", blocks: next };
    }
    case "plan": {
      const entries = (u.entries ?? []).map((e) => ({ content: e.content ?? "", ...(e.status ? { status: e.status } : {}) }));
      const idx = blocks.findIndex((b) => b.kind === "plan");
      const block = { kind: "plan" as const, entries };
      const next = idx >= 0 ? blocks.map((b, i) => (i === idx ? block : b)) : [...blocks, block];
      return { ...v, blocks: next };
    }
    case "usage_update": {
      const usage = (u as unknown as { usage?: AcpUsage }).usage;
      return usage ? { ...v, usage } : v;
    }
    default:
      return v; // available_commands_update, mode changes, etc. — not rendered in the transcript
  }
}

/** Fold one server message into the view-model. */
export function applyAcpMessage(v: AcpView, msg: AcpServerMessage): AcpView {
  switch (msg.type) {
    case "ready": return { ...v, ready: true, status: v.status === "connecting" ? "ready" : v.status };
    case "update": return applyUpdate(v, msg.update);
    case "turn_end": return { ...v, status: "idle", usage: msg.usage ?? v.usage, blocks: [...v.blocks, { kind: "turn", stopReason: msg.stopReason }] };
    case "error": return { ...v, status: "error", blocks: [...v.blocks, { kind: "error", message: msg.message }] };
    default: return v;
  }
}

// The ACP stream → view-model reducer (pure). Proves the structured stream folds
// into renderable blocks: coalesced agent text, tool-call lifecycle + diffs, plans,
// turn dividers, errors, usage — the heart of "render off the TUI" + the trace.
import { describe, it, expect } from "vitest";
import { applyAcpMessage, initialAcpView } from "../../src/client/shell/stage/acp-model.js";
import type { AcpServerMessage } from "#shared/index.js";

const fold = (msgs: AcpServerMessage[]) => msgs.reduce(applyAcpMessage, initialAcpView);

describe("applyAcpMessage", () => {
  it("ready flips status; connecting → ready", () => {
    const v = fold([{ type: "ready", sessionId: "s1" }]);
    expect(v.ready).toBe(true);
    expect(v.status).toBe("ready");
  });

  it("coalesces consecutive agent_message_chunk text into ONE block", () => {
    const v = fold([
      { type: "ready", sessionId: "s1" },
      { type: "update", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "O" } } },
      { type: "update", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "K" } } },
    ]);
    expect(v.blocks).toEqual([{ kind: "agent", text: "OK" }]);
    expect(v.status).toBe("working");
  });

  it("tool_call then tool_call_update merge by toolCallId (status lifecycle + diffs)", () => {
    const v = fold([
      { type: "update", update: { sessionUpdate: "tool_call", toolCall: { toolCallId: "t1", title: "Edit foo.ts", kind: "edit", status: "pending" } } },
      { type: "update", update: { sessionUpdate: "tool_call_update", toolCall: { toolCallId: "t1", status: "completed", content: [{ type: "diff", path: "foo.ts", oldText: "a", newText: "b" }] } } },
    ]);
    expect(v.blocks).toHaveLength(1);
    expect(v.blocks[0]).toEqual({
      kind: "tool", id: "t1", title: "Edit foo.ts", toolKind: "edit", status: "completed",
      diffs: [{ path: "foo.ts", oldText: "a", newText: "b" }],
    });
  });

  it("plan updates replace the single plan block", () => {
    const v = fold([
      { type: "update", update: { sessionUpdate: "plan", entries: [{ content: "step 1", status: "pending" }] } },
      { type: "update", update: { sessionUpdate: "plan", entries: [{ content: "step 1", status: "completed" }, { content: "step 2" }] } },
    ]);
    expect(v.blocks.filter((b) => b.kind === "plan")).toHaveLength(1);
    expect(v.blocks[0]).toEqual({ kind: "plan", entries: [{ content: "step 1", status: "completed" }, { content: "step 2" }] });
  });

  it("turn_end appends a divider, sets idle, captures usage; error sets error status", () => {
    const ended = fold([{ type: "turn_end", stopReason: "end_turn", usage: { totalTokens: 42 } }]);
    expect(ended.status).toBe("idle");
    expect(ended.usage).toEqual({ totalTokens: 42 });
    expect(ended.blocks).toEqual([{ kind: "turn", stopReason: "end_turn" }]);

    const errored = fold([{ type: "error", message: "boom" }]);
    expect(errored.status).toBe("error");
    expect(errored.blocks).toEqual([{ kind: "error", message: "boom" }]);
  });

  it("unknown update variants are ignored (e.g. available_commands_update)", () => {
    const v = fold([{ type: "update", update: { sessionUpdate: "available_commands_update" } }]);
    expect(v.blocks).toEqual([]);
  });
});

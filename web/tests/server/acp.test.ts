// Hermetic test of the ACP relay's socket↔session dispatch (handleAcpSocket).
// No subprocess: a fake AcpSession + fake ws prove the wire mapping (prompt/cancel
// dispatch, trace replay on attach, structured-event forwarding, detach on close).
// The real adapter spawn is exercised by the live smoke (Spike #2 Phase D).
import { describe, it, expect, vi } from "vitest";
import { handleAcpSocket } from "../../src/server/acp.js";
import type { AcpServerMessage } from "#shared/index.js";

// a minimal stand-in for the `ws` WebSocket the relay uses
function fakeWs() {
  const handlers: Record<string, (arg: unknown) => void> = {};
  return {
    readyState: 1,
    OPEN: 1,
    sent: [] as AcpServerMessage[],
    send(s: string) { this.sent.push(JSON.parse(s)); },
    on(ev: string, cb: (arg: unknown) => void) { handlers[ev] = cb; },
    emit(ev: string, arg: unknown) { handlers[ev]?.(arg); },
  };
}

// a fake AcpSession exposing only what the relay touches
function fakeSession() {
  let emit: (m: AcpServerMessage) => void = () => {};
  return {
    trace: [{ type: "ready", sessionId: "s1" }] as AcpServerMessage[],
    prompt: vi.fn(),
    cancel: vi.fn(),
    attach: vi.fn(function (this: unknown, e: (m: AcpServerMessage) => void) {
      emit = e;
      // mirror AcpSession.attach: replay the recorded trace to the joining socket
      for (const m of (this as { trace: AcpServerMessage[] }).trace) e(m);
    }),
    detach: vi.fn(() => { emit = () => {}; }),
    pushLive(m: AcpServerMessage) { emit(m); },
  };
}

describe("handleAcpSocket (ACP relay dispatch)", () => {
  it("replays the trace to a joining socket", () => {
    const ws = fakeWs();
    const sess = fakeSession();
    handleAcpSocket(ws as never, sess as never);
    expect(sess.attach).toHaveBeenCalledOnce();
    expect(ws.sent).toEqual([{ type: "ready", sessionId: "s1" }]); // the trace, replayed
  });

  it("forwards a structured live update to the socket as JSON", () => {
    const ws = fakeWs();
    const sess = fakeSession();
    handleAcpSocket(ws as never, sess as never);
    ws.sent.length = 0; // ignore the replayed trace
    sess.pushLive({ type: "update", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } } });
    expect(ws.sent).toEqual([
      { type: "update", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } } },
    ]);
  });

  it("routes a prompt message to session.prompt and cancel to session.cancel", () => {
    const ws = fakeWs();
    const sess = fakeSession();
    handleAcpSocket(ws as never, sess as never);
    ws.emit("message", Buffer.from(JSON.stringify({ type: "prompt", text: "do the thing" })));
    expect(sess.prompt).toHaveBeenCalledWith("do the thing");
    ws.emit("message", Buffer.from(JSON.stringify({ type: "cancel" })));
    expect(sess.cancel).toHaveBeenCalledOnce();
  });

  it("ignores malformed frames and detaches on close", () => {
    const ws = fakeWs();
    const sess = fakeSession();
    handleAcpSocket(ws as never, sess as never);
    ws.emit("message", Buffer.from("not json{"));
    expect(sess.prompt).not.toHaveBeenCalled();
    ws.emit("close", undefined);
    expect(sess.detach).toHaveBeenCalledOnce();
  });

  it("does not send when the socket is closing (readyState != OPEN)", () => {
    const ws = fakeWs();
    ws.readyState = 3; // CLOSED
    const sess = fakeSession();
    handleAcpSocket(ws as never, sess as never);
    expect(ws.sent).toEqual([]); // the trace replay is suppressed while not OPEN
  });
});

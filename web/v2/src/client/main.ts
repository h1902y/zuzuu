// src/client/main.ts — the PLACEHOLDER workbench client (Rung 3).
//
// Proves the whole loop in a browser: create a shell session, open the binary
// terminal WS, render Output, send keystrokes as Input, and Ack rendered bytes
// so the daemon's flow control can resume past the 128 KB high-water mark. No
// xterm / React yet — raw text only. The real terminal (xterm + WebGL + the
// command-block model) lands in Rung 4; this exists so the daemon has something
// to serve and the round-trip is visible end to end.

import { ClientOp, ServerOp } from "#shared/index.js";

// A tiny browser frame codec — the xterm-free, Buffer-free twin of
// src/server/frames.ts: one opcode byte, then the payload bytes.
const ENC = new TextEncoder();
const DEC = new TextDecoder();
function frame(op: number, payload: string): Uint8Array<ArrayBuffer> {
  const body = ENC.encode(payload);
  // back it with a concrete ArrayBuffer so the type is a BufferSource WebSocket.send accepts.
  const out = new Uint8Array(new ArrayBuffer(body.length + 1));
  out[0] = op;
  out.set(body, 1);
  return out;
}

const screen = document.getElementById("screen") as HTMLDivElement;
const input = document.getElementById("input") as HTMLInputElement;
function write(text: string): void {
  screen.textContent += text;
  screen.scrollTop = screen.scrollHeight;
}

async function main(): Promise<void> {
  // 1) Create a shell session. The browser's cookie — set by the daemon's
  //    ?token= exchange — authenticates this; the daemon spawns a real PTY.
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "shell" }),
  });
  if (!res.ok) { write(`\n[could not create a session: HTTP ${res.status}]\n`); return; }
  const { id } = (await res.json()) as { id: string };

  // 2) Open the binary terminal socket for that session.
  const ws = new WebSocket(`ws://${location.host}/ws/term/${id}`);
  ws.binaryType = "arraybuffer";
  ws.onmessage = (ev) => {
    const buf = new Uint8Array(ev.data as ArrayBuffer);
    const op = buf[0];
    if (op === undefined) return;
    const payload = buf.subarray(1);
    if (op === ServerOp.Output || op === ServerOp.Replay) {
      write(DEC.decode(payload));
      // 3) Ack rendered Output bytes — this is what lets the daemon resume the
      //    PTY after it pauses at the high-water mark (Replay is not counted).
      if (op === ServerOp.Output) ws.send(frame(ClientOp.Ack, JSON.stringify({ bytes: payload.length })));
    }
  };

  // 4) Send keystrokes. (placeholder: a line input — the real terminal in Rung 4
  //    streams raw keys; here Enter sends the line.)
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || ws.readyState !== WebSocket.OPEN) return;
    ws.send(frame(ClientOp.Input, input.value + "\n"));
    input.value = "";
  });
}

void main();

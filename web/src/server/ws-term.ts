import { ClientOp, type AckPayload, type ResizePayload } from "#shared/index.js";
import { decodeFrame } from "./frames.js";
import type { TermTransport } from "./transport.js";
import type { Session } from "./sessions.js";

/**
 * Wire a terminal transport to a session: inbound frames decode to
 * write/resize/ack. This is the protocol layer — transport-blind (the transport
 * already handed us raw binary frames), so it serves any TermTransport (a
 * WebSocket today, WebTransport later).
 */
export function attachTerm(transport: TermTransport, session: Session): void {
  session.attach(transport);

  transport.onMessage((raw) => {
    let frame: { op: number; payload: Buffer };
    try {
      frame = decodeFrame(Buffer.isBuffer(raw) ? raw : Buffer.from(raw));
    } catch {
      return;
    }
    switch (frame.op) {
      case ClientOp.Input:
        session.write(frame.payload.toString("utf8"));
        break;
      case ClientOp.Resize: {
        try {
          const { cols, rows } = JSON.parse(frame.payload.toString("utf8")) as ResizePayload;
          session.resize(cols, rows);
        } catch {
          // ignore malformed resize
        }
        break;
      }
      case ClientOp.Ack: {
        try {
          const { bytes } = JSON.parse(frame.payload.toString("utf8")) as AckPayload;
          session.ack(bytes);
        } catch {
          // ignore malformed ack
        }
        break;
      }
    }
  });

  transport.onClose(() => session.detach(transport));
}

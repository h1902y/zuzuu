// src/server/transport.ts — the pluggable terminal-transport seam.
//
// The terminal PROTOCOL (1-byte opcode frames, render-gated flow control, the
// headless-mirror replay) lives ABOVE this interface; the transport that moves
// the bytes lives BELOW it and is swappable. Today the only implementation is
// WsTermTransport (a `ws` WebSocket). A future WebTransportTermTransport (HTTP/3
// + QUIC, for the cloud session waves) implements the same five methods and
// nothing in sessions.ts / term-protocol.ts changes — the irreducibly-custom protocol
// stays sealed off from the eventually-standardizable transport.
//
// See docs/inspiration/2026-06-23-terminal-standards-adoption.md for why the
// protocol stays custom and only the transport layer is standardizable.

import type { WebSocket } from "ws";

/**
 * Moves opaque framed bytes in/out of ONE attached client, plus liveness and
 * lifecycle. The protocol layer frames/decodes; the transport stays blind to
 * what the bytes mean.
 */
export interface TermTransport {
  /** Send one already-framed message (opcode byte + payload). */
  send(frame: Uint8Array): void;
  /** Close the underlying connection. */
  close(code?: number, reason?: string): void;
  /** True while the connection can accept a send. */
  readonly isOpen: boolean;
  /**
   * Register the inbound-frame handler. Delivers each client→server frame as
   * raw bytes (the protocol layer decodes). Binary-only; stray text frames are
   * dropped by the implementation.
   */
  onMessage(cb: (frame: Uint8Array) => void): void;
  /** Register the close handler (fires once when the connection ends). */
  onClose(cb: () => void): void;
}

/**
 * The WebSocket-backed transport — the only implementation today, and the ONE
 * place the terminal path imports `ws`. A thin adapter: send/close/readyState
 * map straight through; onMessage drops non-binary frames (terminal I/O is
 * binary) exactly as the old ws-term handler did.
 */
export class WsTermTransport implements TermTransport {
  constructor(private readonly ws: WebSocket) {}

  send(frame: Uint8Array): void {
    this.ws.send(frame);
  }

  close(code?: number, reason?: string): void {
    this.ws.close(code, reason);
  }

  get isOpen(): boolean {
    return this.ws.readyState === this.ws.OPEN;
  }

  onMessage(cb: (frame: Uint8Array) => void): void {
    this.ws.on("message", (raw, isBinary) => {
      if (!isBinary && !Buffer.isBuffer(raw)) return;
      cb(Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer));
    });
  }

  onClose(cb: () => void): void {
    this.ws.on("close", cb);
  }
}

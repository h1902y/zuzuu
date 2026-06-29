// src/client/lib/acp-client.ts — the /ws/acp/:id client (ACP drive lane, Spike #2).
// A per-session WebSocket to the daemon's ACP relay: receives the structured
// session/update stream (AcpServerMessage), sends prompts/cancel. Mirrors the
// fs-events client shape; reconnect replays the daemon's trace so a blip is lossless.
import type { AcpClientMessage, AcpServerMessage } from "#shared/index.js";
import { wsUrl } from "./api.js";

export class AcpConnection {
  private ws: WebSocket | null = null;
  private closed = false;
  private retries = 0;

  constructor(
    private readonly id: string,
    private readonly onMessage: (m: AcpServerMessage) => void,
  ) {}

  connect(): void {
    if (this.closed) return;
    const ws = new WebSocket(wsUrl(`/ws/acp/${this.id}`));
    this.ws = ws;
    ws.onopen = () => { this.retries = 0; };
    ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(ev.data as string) as AcpServerMessage);
      } catch { /* ignore malformed frames */ }
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.closed) return;
      // reconnect (capped backoff); the daemon replays its trace on reattach
      const delay = Math.min(500 * 2 ** this.retries, 8000);
      this.retries += 1;
      setTimeout(() => this.connect(), delay);
    };
  }

  send(msg: AcpClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.closed = true;
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
  }
}

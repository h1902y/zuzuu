// src/client/lib/brain-events.ts — the /ws/zuzuu client (live brain invalidation).
//
// A singleton WS to the daemon's brain watcher. No subscription protocol — the
// server watches every brain surface; we just listen and hand each coarse
// {module, kind} signal to the listener (WorkbenchShell invalidates ["zuzuu"]).
// Reconnects like fs-events: indefinite capped backoff + wake on online/refocus.

import type { BrainServerMessage } from "#shared/index.js";
import { wsUrl } from "./api.js";

type BrainListener = (msg: BrainServerMessage) => void;

class BrainEvents {
  private ws: WebSocket | null = null;
  private listener: BrainListener | null = null;
  private retries = 0;
  private started = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  start(listener: BrainListener): void {
    this.listener = listener;
    if (this.started) return;
    this.started = true;
    if (typeof window !== "undefined") window.addEventListener("online", this.wake);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.wake);
    this.connect();
  }

  private readonly wake = (): void => {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;
    this.retries = 0;
    this.connect();
  };

  /** Re-bind the push channel to the CURRENT workspace (audit item 5): the daemon
   *  resolves the watched root at UPGRADE time, so after an in-place workspace
   *  switch the old socket keeps watching the OLD project and live updates
   *  silently die. Closing here → onclose → immediate reconnect against the new root. */
  restart(): void {
    if (!this.started) return;
    this.retries = 0;
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) this.ws.close();
    else this.connect();
  }

  private connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = new WebSocket(wsUrl("/ws/zuzuu"));
    this.ws = ws;
    ws.onopen = () => { this.retries = 0; };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as BrainServerMessage;
        if (msg.type === "brain") this.listener?.(msg);
      } catch { /* ignore malformed frames */ }
    };
    ws.onclose = () => {
      this.ws = null;
      // retries=0 (a restart() or fresh wake) reconnects immediately; failures back off
      const delay = this.retries === 0 ? 0 : Math.min(500 * 2 ** this.retries, 8000);
      this.retries += 1;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    };
  }
}

export const brainEvents = new BrainEvents();

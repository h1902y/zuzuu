// src/client/lib/fs-events.ts — the /ws/fs client (live tree invalidation).
//
// A singleton WS to the daemon's chokidar layer. Tracks which directories the
// explorer has expanded and re-subscribes them after a reconnect; the daemon
// watches each (non-recursively) and pushes "changed" events the tree reacts to.

import type { FsServerMessage } from "#shared/index.js";
import { wsUrl } from "./api.js";

type ChangeListener = (path: string) => void;

class FsEvents {
  private ws: WebSocket | null = null;
  private readonly watched = new Set<string>();
  private listener: ChangeListener | null = null;
  private retries = 0;
  private started = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  start(listener: ChangeListener): void {
    this.listener = listener;
    if (this.started) return;
    this.started = true;
    this.watched.add(""); // root is always visible
    // Recover like the terminal: indefinite reconnect + wake on network-return /
    // tab-refocus, so the tree never silently stops updating after a sleep/blip.
    if (typeof window !== "undefined") window.addEventListener("online", this.wake);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.wake);
    this.connect();
  }

  private readonly wake = (): void => {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;
    this.retries = 0; // a wake is a fresh start
    this.connect();
  };

  private connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = new WebSocket(wsUrl("/ws/fs"));
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      for (const path of this.watched) ws.send(JSON.stringify({ type: "watch", path }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as FsServerMessage;
        if (msg.type === "changed") this.listener?.(msg.path);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      this.ws = null;
      // Reconnect indefinitely (capped backoff) — never give up, or the tree
      // goes stale for the rest of the session after a long outage.
      const delay = Math.min(500 * 2 ** this.retries, 8000);
      this.retries += 1;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    };
  }

  watch(path: string): void {
    if (this.watched.has(path)) return;
    this.watched.add(path);
    this.send({ type: "watch", path });
  }

  unwatch(path: string): void {
    if (path === "" || !this.watched.delete(path)) return;
    this.send({ type: "unwatch", path });
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}

export const fsEvents = new FsEvents();

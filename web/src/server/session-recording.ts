// src/server/session-recording.ts — one job: the per-session asciicast capture.
//
// A ring-buffered record of PTY output ("o") and resizes ("r") — input is NEVER
// recorded — plus the OSC 133 command-boundary marks, serialized to asciicast v2
// (NDJSON) on demand. The Session composes one and feeds it each output chunk via
// a narrow surface (record / mark / toAsciicast); the flow-control hot path stays
// in session.ts. Pairs with cast.ts (the body assembler).

import { castBody, type CastEvent, type CastMark } from "./cast.js";

/** asciicast ring buffer caps */
const REC_MAX_BYTES = 2 * 1024 * 1024;
const REC_MAX_EVENTS = 10_000;
/** Cap on command-boundary marks kept for the recording (ring; newest win). */
const REC_MAX_MARKS = 1000;

export class SessionRecording {
  // asciicast v2 ring buffer ("o" + "r" only — input is never recorded)
  private readonly events: CastEvent[] = [];
  private bytes = 0;
  /** true once the ring buffer has dropped its oldest events */
  truncated = false;
  // Wave D: command-boundary markers (from OSC 133 "C") → asciicast `m` events
  // so the recording's seek bar gets navigable per-command chapters.
  private readonly marks: CastMark[] = [];
  private cmdCount = 0;

  constructor(private readonly createdAt: number) {}

  /** Record a PTY output ("o") or resize ("r") event. */
  record(code: "o" | "r", data: string): void {
    this.events.push([(Date.now() - this.createdAt) / 1000, code, data]);
    this.bytes += data.length;
    while (
      this.events.length > REC_MAX_EVENTS ||
      (this.bytes > REC_MAX_BYTES && this.events.length > 1)
    ) {
      const dropped = this.events.shift()!;
      this.bytes -= dropped[2].length;
      this.truncated = true;
    }
  }

  /** Record a command-boundary mark (from OSC 133 "C"). */
  mark(): void {
    this.marks.push({ t: (Date.now() - this.createdAt) / 1000, label: String(++this.cmdCount) });
    if (this.marks.length > REC_MAX_MARKS) this.marks.shift();
  }

  /** Serialize the buffer as asciicast v2 (NDJSON), given the caller's header. */
  toAsciicast(header: Record<string, unknown>): string {
    const lines = [JSON.stringify(header)];
    // interleave the command-boundary marks as asciicast `m` events (Wave D)
    for (const line of castBody(this.events, this.marks)) {
      lines.push(JSON.stringify(line));
    }
    return lines.join("\n") + "\n";
  }
}

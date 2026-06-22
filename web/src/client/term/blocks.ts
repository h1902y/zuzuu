// src/client/term/blocks.ts — the command-block model (OSC 133 → blocks).
//
// One prompt → command → output → exit cycle, derived from the shell's OSC 133
// A/B/C/D marks (emitted by the daemon's shell-integration injection). Line
// numbers are absolute buffer rows (via xterm markers) so they survive scroll.

import type { IMarker, Terminal } from "@xterm/xterm";
import { detectQuickFix, type QuickFix } from "./quickfix.js";

export interface Block {
  id: number;
  /** absolute row where the command's output starts (after C) */
  outputStart: number;
  /** absolute row where the block ends (at D); null while running */
  outputEnd: number | null;
  command: string;
  exitCode: number | null;
  startedAt: number;
  durationMs: number | null;
  /** one-click fix when the command failed with a known pattern */
  fix?: QuickFix;
}

export interface BlockEvents {
  onChange: (blocks: Block[]) => void;
  onCommand: (command: string) => void;
}

/** Fed OSC 133 payloads ("A", "B", "C", "D;0", …), maintains the block list. */
export class BlockTracker {
  private blocks: Block[] = [];
  private nextId = 1;
  private bMarker: IMarker | null = null;
  /** cursor column when B fired — the prompt ends here, the command begins */
  private bCol = 0;
  private pending: Block | null = null;

  constructor(
    private readonly term: Terminal,
    private readonly events: BlockEvents,
  ) {}

  /** payload is everything after "133;" — e.g. "A", "B", "C", "D;0". */
  handle(payload: string): void {
    const kind = payload[0];
    if (kind === "A") {
      this.bMarker = null; // close any still-open block defensively
    } else if (kind === "B") {
      this.bMarker = this.term.registerMarker(0);
      this.bCol = this.term.buffer.active.cursorX;
    } else if (kind === "C") {
      const command = this.readCommand();
      const start = this.term.registerMarker(0);
      this.pending = {
        id: this.nextId++,
        outputStart: start?.line ?? this.absCursorRow(),
        outputEnd: null,
        command,
        exitCode: null,
        startedAt: performance.now(),
        durationMs: null,
      };
      this.blocks.push(this.pending);
      if (command) this.events.onCommand(command);
      this.emit();
    } else if (kind === "D" && this.pending) {
      const exit = Number(payload.split(";")[1] ?? "");
      this.pending.exitCode = Number.isFinite(exit) ? exit : null;
      this.pending.outputEnd = this.absCursorRow();
      this.pending.durationMs = performance.now() - this.pending.startedAt;
      this.pending.fix = detectQuickFix(this.pending.command, this.outputText(this.pending), this.pending.exitCode) ?? undefined;
      this.pending = null;
      this.emit();
    }
  }

  /** The typed command, read between the B marker and the cursor; the first row
   *  is sliced at bCol so the prompt prefix is excluded. */
  private readCommand(): string {
    const buf = this.term.buffer.active;
    const from = this.bMarker?.line ?? this.absCursorRow();
    const to = this.absCursorRow();
    let cmd = "";
    for (let row = from; row <= to; row++) {
      const line = buf.getLine(row);
      if (!line) continue;
      const full = row === from ? line.translateToString(true).slice(this.bCol) : line.translateToString(true);
      cmd += (row > from && !line.isWrapped ? "\n" : "") + full;
    }
    return cmd.trim();
  }

  private absCursorRow(): number {
    const buf = this.term.buffer.active;
    return buf.baseY + buf.cursorY;
  }

  /** A block's output text (for copy); wrapped rows rejoin without a newline. */
  outputText(block: Block): string {
    const buf = this.term.buffer.active;
    const end = block.outputEnd ?? buf.baseY + buf.cursorY;
    let out = "";
    for (let row = block.outputStart; row < end; row++) {
      const line = buf.getLine(row);
      if (!line) continue;
      out += (row > block.outputStart && !line.isWrapped ? "\n" : "") + line.translateToString(true);
    }
    return out.replace(/\n+$/, "");
  }

  list(): Block[] {
    return this.blocks;
  }

  private emit(): void {
    this.events.onChange([...this.blocks]);
  }

  dispose(): void {
    this.blocks = [];
  }
}

// src/client/term/TermView.tsx — the live terminal pane.
//
// Wires xterm (WebGL renderer + addons) to a TermConnection: keystrokes →
// sendInput, output → term.write (the connection acks rendered bytes for flow
// control), resize → fit + sendResize. OSC 133 marks feed the BlockTracker (the
// command-block model). Reattach replays the server-side snapshot, so a reload
// or a network blip never loses the session.

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { TermConnection } from "./connection.js";
import { BlockTracker } from "./blocks.js";
import { useWorkbench } from "../state/store.js";

const FONT_FAMILY = '"JetBrains Mono Variable", ui-monospace, Menlo, monospace';
const THEME = {
  background: "#0e0f12",
  foreground: "#d6dde8",
  cursor: "#5be6c4",
  cursorAccent: "#0e0f12",
  selectionBackground: "#2c4f6e80",
  black: "#11161f", red: "#f47067", green: "#57ab5a", yellow: "#c69026",
  blue: "#539bf5", magenta: "#b083f0", cyan: "#39c5cf", white: "#909dab",
  brightBlack: "#545d68", brightRed: "#ff938a", brightGreen: "#6bc46d", brightYellow: "#daaa3f",
  brightBlue: "#6cb6ff", brightMagenta: "#dcbdfb", brightCyan: "#56d4dd", brightWhite: "#cdd9e5",
};

export function TermView({ sessionId }: { sessionId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const setStatus = useWorkbench((s) => s.setStatus);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      theme: THEME,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 10000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new SearchAddon());
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new ClipboardAddon());
    const unicode = new Unicode11Addon();
    term.loadAddon(unicode);
    term.unicode.activeVersion = "11";
    term.open(host);
    try {
      term.loadAddon(new WebglAddon()); // hardware renderer; falls back to canvas if unavailable
    } catch {
      /* no WebGL (headless / old GPU) — xterm uses its DOM renderer */
    }
    fit.fit();

    // the command-block model: OSC 133 A/B/C/D → blocks (gutter UI lands in Rung 5)
    const blocks = new BlockTracker(term, { onChange: () => {}, onCommand: () => {} });
    term.parser.registerOscHandler(133, (data) => {
      blocks.handle(data);
      return false; // let xterm keep processing
    });

    const conn = new TermConnection(sessionId, term, {
      onStatus: setStatus,
      onTitle: () => {},
      onExit: () => {},
      onCwd: () => {},
    });
    const inputSub = term.onData((d) => conn.sendInput(d));

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        conn.sendResize(term.cols, term.rows);
      } catch {
        /* host detached mid-resize */
      }
    });
    ro.observe(host);

    conn.connect();
    term.focus();

    return () => {
      ro.disconnect();
      inputSub.dispose();
      conn.dispose();
      blocks.dispose();
      term.dispose();
    };
  }, [sessionId, setStatus]);

  return <div ref={hostRef} className="h-full w-full bg-app p-1" />;
}

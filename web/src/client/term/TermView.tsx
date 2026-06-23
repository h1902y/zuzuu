// src/client/term/TermView.tsx — the live terminal pane.
//
// Wires xterm (WebGL renderer + addons) to a TermConnection: keystrokes →
// sendInput, output → term.write (the connection acks rendered bytes for flow
// control), resize → fit + sendResize. Reattach replays the server-side
// snapshot, so a reload or a network blip never loses the session.

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { TermConnection } from "./connection.js";
import { registerTermConn, unregisterTermConn } from "./connections.js";
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
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new ClipboardAddon());
    const unicode = new Unicode11Addon();
    term.loadAddon(unicode);
    term.unicode.activeVersion = "11";
    term.open(host);
    fit.fit();

    // WebGL is a progressive enhancement (hardware renderer) — dynamic-import it
    // after first paint so its ~127 KB stays out of the main bundle. The terminal
    // renders via the DOM renderer until it attaches; absent WebGL falls back silently.
    let webglDisposed = false;
    void import("@xterm/addon-webgl")
      .then(({ WebglAddon }) => {
        if (webglDisposed) return;
        try { term.loadAddon(new WebglAddon()); } catch { /* no WebGL — DOM renderer */ }
      })
      .catch(() => {});

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
    registerTermConn(sessionId, conn); // so the composer can send to this session's PTY
    term.focus();

    return () => {
      webglDisposed = true;
      unregisterTermConn(sessionId);
      ro.disconnect();
      inputSub.dispose();
      conn.dispose();
      term.dispose();
    };
  }, [sessionId, setStatus]);

  return <div ref={hostRef} className="h-full w-full bg-app p-1" />;
}

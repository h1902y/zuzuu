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
import { reportAgentExit } from "../state/session-close.js";

// the terminal is a deep-ebony island in BOTH themes (#14170f, per the design tokens);
// Anonymous Pro for the coder character. ANSI palette tuned to the mint/coral system.
const FONT_FAMILY = '"Anonymous Pro", ui-monospace, SFMono-Regular, Menlo, monospace';
const THEME = {
  background: "#14170f",
  foreground: "#eafdcf",
  cursor: "#f25c54",
  cursorAccent: "#14170f",
  selectionBackground: "#4e554399",
  black: "#1b1f15", red: "#ef5350", green: "#7fb069", yellow: "#e0a83c",
  blue: "#8e95d8", magenta: "#b6a9c9", cyan: "#9fc27a", white: "#ccddb4",
  brightBlack: "#6e7860", brightRed: "#f25c54", brightGreen: "#9fc27a", brightYellow: "#ecc36a",
  brightBlue: "#a8aee4", brightMagenta: "#ccc0dd", brightCyan: "#b9d79a", brightWhite: "#eafdcf",
};

export function TermView({ sessionId, active = true }: { sessionId: string; active?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const setStatus = useWorkbench((s) => s.setStatus);

  // Focus the terminal when this pane becomes the active session. Panes are kept
  // MOUNTED across session switches (the shell stacks one per session and toggles
  // visibility) — so a switch never reattaches/replays (no flicker, no lost
  // alt-screen TUI). Focus therefore follows selection, not mount.
  useEffect(() => {
    if (active) termRef.current?.focus();
  }, [active]);

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
      // Agent PTY exit = the reflective moment (U5): report it so the close-card
      // detector can poll the close result. Read the type at exit-time from the
      // store (the session list is authoritative); a shell exit is a no-op.
      onExit: () => {
        const session = useWorkbench.getState().sessions.find((s) => s.id === sessionId);
        if (session?.type === "agent") reportAgentExit(sessionId);
      },
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
    termRef.current = term;
    if (active) term.focus(); // focus on mount only when this is the visible pane

    return () => {
      webglDisposed = true;
      unregisterTermConn(sessionId);
      ro.disconnect();
      inputSub.dispose();
      conn.dispose();
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId, setStatus]);

  return <div ref={hostRef} className="h-full w-full bg-app p-1" />;
}

// src/client/composer/Composer.tsx — the agent-session input surface.
//
// A REMOTE KEYBOARD into the live interactive host TUI: typing is fully local
// (snappy); on Send the message ships to the host agent's stdin via the EXISTING
// terminal connection (no new opcode, no change to the flow-control loop). We
// deliver the body and the submit (CR) as TWO writes with a settle delay
// (composer-logic.inputFrames) — sending them fused races Claude Code's paste
// debounce and the Enter gets swallowed (the "input never submits" bug).
//
// While the agent is producing output we queue the send and flush ONE message per
// quiescence tick (the busy→ready edge) so we never inject mid-turn. Stop(^C)/Esc
// cover the raw-control moments — permission prompts (y/n) and interrupts go here,
// never through the composer text. When a full-screen TUI owns the screen
// (alt-screen) the footer says so: the composer IS the agent's keyboard, so the
// user drives it here rather than reaching into the terminal's own prompt.
// Rendered only for type:"agent" sessions; shell sessions keep the raw terminal.

import { useEffect, useRef, useState } from "react";
import { Circle } from "lucide-react";
import { PromptInput } from "./PromptInput.js";
import { HostPill } from "./HostPill.js";
import { inputFrames, isReady, SUBMIT_DELAY_MS, type InputOpts } from "./composer-logic.js";
import { composerStatus } from "./composer-status.js";
import { hostInputProfile } from "./host-input.js";
import { getTermConn } from "../term/connections.js";
import { useWorkbench } from "../state/store.js";
import { Inline, Text, Icon, Button } from "../ds/index.js";

/** Deliver one message to the session's PTY as a remote keyboard: the body now,
 *  then the submit key after a settle delay (re-looked-up so a dispose mid-delay is
 *  a no-op, never a stray submit on the wrong connection). The host's profile picks
 *  the submit key + paste behavior. */
function deliverTo(sessionId: string, text: string, opts: InputOpts): void {
  const conn = getTermConn(sessionId);
  if (!conn) return;
  const { body, submit } = inputFrames(text, opts);
  conn.sendInput(body);
  window.setTimeout(() => getTermConn(sessionId)?.sendInput(submit), SUBMIT_DELAY_MS);
}

export function Composer({ sessionId }: { sessionId: string }) {
  const send = (data: string) => getTermConn(sessionId)?.sendInput(data);

  // The active session's host → its input profile (quiescence window, submit key,
  // paste behavior). A session's host is immutable, but we keep the profile in a ref
  // so the polled tick always reads the current one without re-subscribing.
  const host = useWorkbench((s) => s.sessions.find((x) => x.id === sessionId)?.host);
  const profile = hostInputProfile(host);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const lastOutputAt = useRef(0); // 0 = no output seen yet → treated as ready
  const queue = useRef<string[]>([]);
  const [ready, setReady] = useState(true);
  const [tuiActive, setTuiActive] = useState(false);
  const [queued, setQueued] = useState(0); // pending messages held while the agent is busy

  const readyNow = () =>
    lastOutputAt.current === 0 || isReady(lastOutputAt.current, Date.now(), profileRef.current.quietMs);

  // Watch the session's output stream for activity and drive the busy/ready state,
  // the queue flush, and the alt-screen (TUI) indicator. Polled (not per-frame) so
  // it never sits in the render path; the onActivity hook is additive and
  // re-asserted each tick to survive the mount race with TermView registering the
  // connection.
  useEffect(() => {
    const onAct = () => { lastOutputAt.current = Date.now(); };
    const tick = () => {
      const conn = getTermConn(sessionId);
      conn?.onActivity(onAct);
      setTuiActive(conn?.isAltScreen?.() ?? false); // optional-call: tolerate a stale conn (HMR/version skew)
      const r = readyNow();
      setReady(r);
      // Drain ONE queued message per tick: sending body+submit for each makes the
      // agent busy again, so the next flush waits for the next ready edge — natural
      // backpressure, and no interleaving of bodies/submits across messages.
      if (r && queue.current.length) deliverTo(sessionId, queue.current.shift()!, profileRef.current);
      setQueued(queue.current.length);
    };
    const id = setInterval(tick, 200);
    return () => { clearInterval(id); getTermConn(sessionId)?.onActivity(null); };
  }, [sessionId]);

  const submit = (text: string) => {
    // The terminal IS the transcript — the host TUI echoes the submitted message,
    // so the composer renders no echo of its own (no duplicate, no pile-up).
    if (readyNow()) deliverTo(sessionId, text, profile);
    else { queue.current.push(text); setQueued(queue.current.length); } // hold until the agent is quiet
  };

  const clearQueue = () => { queue.current = []; setQueued(0); };

  // What the user SEES: Ready · Working… · N queued, with a dot that warms while busy.
  const status = composerStatus(ready, queued);

  return (
    <PromptInput
      onSubmit={submit}
      autoFocus
      placeholder={tuiActive ? "Message the agent — this drives its prompt…" : "Message the agent…"}
      footer={
        <>
          <HostPill sessionId={sessionId} />
          {/* status: a passive dot + label (warms to accent while the agent works) —
              kept visually distinct from the controls so it never reads as a button. */}
          <Inline
            gap="xs"
            align="center"
            aria-live="polite"
            title={profile.verified ? undefined : `input timing not yet verified for ${host ?? "this host"} — using defaults`}
          >
            <Text tone={status.busy ? "accent" : "muted"}><Icon icon={Circle} size={8} fill="currentColor" /></Text>
            <Text size="meta" tone="muted">{status.label}{!profile.verified && " · ?"}</Text>
          </Inline>
          {queued > 0 && (
            <Button variant="ghost" size="sm" onClick={clearQueue} title="discard queued messages">Clear</Button>
          )}
          {/* Stop only matters mid-turn — surface it while busy, so the calm state stays calm. */}
          {status.busy && (
            <Button variant="ghost" size="sm" onClick={() => send("\x03")} title="interrupt the agent (Ctrl-C)">Stop</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => send("\x1b")} title="send Escape — answer a prompt or close a menu">Esc</Button>
        </>
      }
    />
  );
}

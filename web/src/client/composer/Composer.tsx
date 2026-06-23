// src/client/composer/Composer.tsx — the agent-session input surface.
//
// Typing is fully local (snappy); on Send the whole message ships to the host
// agent's stdin as a bracketed-paste block via the EXISTING terminal connection
// (no new opcode, no change to the flow-control loop), and is appended to the
// local send-log. While the agent is producing output we queue the send and flush
// on quiescence (the busy→ready edge) so we never inject mid-turn. Stop(^C)/Esc
// cover the raw-control moments — permission prompts (y/n) and interrupts go here,
// never through the composer text. Rendered only for type:"agent" sessions; shell
// sessions keep the raw terminal, which stays mounted above this.

import { useEffect, useRef, useState } from "react";
import { PromptInput } from "./PromptInput.js";
import { HostPill } from "./HostPill.js";
import { bracketedPaste, isReady } from "./composer-logic.js";
import { getTermConn } from "../term/connections.js";
import { useSendLog } from "../state/sendlog.js";

export function Composer({ sessionId }: { sessionId: string }) {
  const send = (data: string) => getTermConn(sessionId)?.sendInput(data);
  const turns = useSendLog((s) => s.turns).filter((t) => t.sessionId === sessionId);

  const lastOutputAt = useRef(0); // 0 = no output seen yet → treated as ready
  const queue = useRef<string[]>([]);
  const [ready, setReady] = useState(true);

  const readyNow = () => lastOutputAt.current === 0 || isReady(lastOutputAt.current, Date.now());

  // Watch the session's output stream for activity and drive the busy/ready state
  // + queue flush. Polled (not per-frame) so it never sits in the render path; the
  // onActivity hook is additive and re-asserted each tick to survive the mount race
  // with TermView registering the connection.
  useEffect(() => {
    const onAct = () => { lastOutputAt.current = Date.now(); };
    const tick = () => {
      getTermConn(sessionId)?.onActivity(onAct);
      const r = readyNow();
      setReady(r);
      if (r && queue.current.length) {
        const pending = queue.current;
        queue.current = [];
        pending.forEach((bytes) => send(bytes));
      }
    };
    const id = setInterval(tick, 200);
    return () => { clearInterval(id); getTermConn(sessionId)?.onActivity(null); };
  }, [sessionId]);

  const submit = (text: string) => {
    useSendLog.getState().add(sessionId, text); // the turn shows immediately
    const bytes = bracketedPaste(text);
    if (readyNow()) send(bytes);
    else queue.current.push(bytes); // hold until the agent is quiet
  };

  return (
    <div className="flex flex-col">
      {turns.length > 0 && (
        <div className="max-h-40 overflow-y-auto px-3 pt-2">
          {turns.map((t) => (
            <div
              key={t.id}
              className="mb-1 ml-auto max-w-[80%] rounded-ui bg-elevated px-3 py-1.5 text-ui text-ink-100"
            >
              {t.content}
            </div>
          ))}
        </div>
      )}
      <PromptInput
        onSubmit={submit}
        footer={
          <>
            <HostPill sessionId={sessionId} />
            <span className={`text-meta ${ready ? "text-muted" : "text-accent"}`} aria-live="polite">
              {ready ? "ready" : "working…"}
            </span>
            <button
              onClick={() => send("\x03")}
              title="interrupt the agent (Ctrl-C)"
              className="rounded-ui px-2 py-1 text-meta text-muted hover:text-danger"
            >
              Stop
            </button>
            <button
              onClick={() => send("\x1b")}
              title="send Escape"
              className="rounded-ui px-2 py-1 text-meta text-muted hover:text-subtle"
            >
              Esc
            </button>
          </>
        }
      />
    </div>
  );
}

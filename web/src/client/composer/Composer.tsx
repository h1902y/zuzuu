// src/client/composer/Composer.tsx — the agent-session input surface.
//
// Typing is fully local (snappy); on Send the whole message ships to the host
// agent's stdin as a bracketed-paste block via the EXISTING terminal connection
// (no new opcode, no change to the flow-control loop), and is appended to the
// local send-log. Stop(^C)/Esc cover the raw-control moments — permission prompts
// (y/n) and interrupts go here, never through the composer text. Rendered only for
// type:"agent" sessions; shell sessions keep the raw terminal. The raw terminal
// stays mounted above this; the user-turn blocks sit between it and the input.

import { PromptInput } from "./PromptInput.js";
import { bracketedPaste } from "./composer-logic.js";
import { getTermConn } from "../term/connections.js";
import { useSendLog } from "../state/sendlog.js";

export function Composer({ sessionId }: { sessionId: string }) {
  const send = (data: string) => getTermConn(sessionId)?.sendInput(data);
  const turns = useSendLog((s) => s.turns).filter((t) => t.sessionId === sessionId);

  const submit = (text: string) => {
    useSendLog.getState().add(sessionId, text);
    send(bracketedPaste(text));
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

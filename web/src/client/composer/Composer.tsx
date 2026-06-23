// src/client/composer/Composer.tsx — the agent-session input surface.
//
// Typing is fully local (snappy); on Send the whole message ships to the host
// agent's stdin as a bracketed-paste block via the EXISTING terminal connection
// (no new opcode, no change to the flow-control loop). Stop(^C)/Esc cover the
// raw-control moments — permission prompts (y/n) and interrupts go here, never
// through the composer text. Rendered only for type:"agent" sessions; shell
// sessions keep the raw terminal. The raw terminal stays mounted above this.

import { PromptInput } from "./PromptInput.js";
import { bracketedPaste } from "./composer-logic.js";
import { getTermConn } from "../term/connections.js";

export function Composer({ sessionId }: { sessionId: string }) {
  const send = (data: string) => getTermConn(sessionId)?.sendInput(data);

  return (
    <PromptInput
      onSubmit={(text) => send(bracketedPaste(text))}
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
  );
}
